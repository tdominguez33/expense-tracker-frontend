import { Component, inject, OnInit, signal, computed, DestroyRef, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { RefreshService } from '../../services/refresh.service';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe, Location } from '@angular/common';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { debouncedLoading } from '../../utils/loading';
import { getContrastColor } from '../../utils/color';

@Component({
  selector: 'app-statements',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe, DatePipe],
  templateUrl: './statements.html',
  styleUrl: './statements.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Statements implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private refreshService = inject(RefreshService);
  private destroyRef = inject(DestroyRef);

  accounts = signal<any[]>([]);
  statements = signal<any[]>([]);
  entities = signal<any[]>([]);
  transactions = signal<any[]>([]);
  installments = signal<any[]>([]);
  categories = signal<any[]>([]);
  appTimezone = signal<string>('America/Argentina/Buenos_Aires');
  graceDays = signal<number>(10);

  private entityMap = computed(() => {
    const map = new Map<number, string>();
    for (const e of this.entities()) {
      map.set(Number(e.id), e.name);
    }
    return map;
  });

  private categoryMap = computed(() => {
    const map = new Map<number, { name: string; color: string }>();
    for (const c of this.categories()) {
      map.set(Number(c.id), c);
    }
    return map;
  });

  private todayInTimezone = computed(() => {
    const tz = this.appTimezone();
    try {
      return new Date().toLocaleDateString('en-CA', { timeZone: tz });
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  });

  private statementPeriodCache = new Map<string, string>();

  isLoading = signal<boolean>(true);
  showSpinner = debouncedLoading(this.isLoading, 300);
  hasLoadedOnce = signal<boolean>(false);

  routeId = signal<number | null>(null);
  routeAccountId = signal<number | null>(null);
  viewingDetailsData = signal<{ items: any[]; subtotal: number; tax_amount: number; total_amount: number } | null>(null);
  isLoadingDetails = signal<boolean>(false);
  loadedStatementId = signal<number | null>(null);
  expensesSort = signal<'oldest' | 'amount'>('oldest');

  sortedViewingDetails = computed(() => {
    const items = this.viewingDetailsData()?.items;
    if (!items || items.length === 0) return [];

    const sort = this.expensesSort();
    return [...items].sort((a, b) => {
      if (sort === 'amount') {
        const amtA = Number(a.installment_amount) || 0;
        const amtB = Number(b.installment_amount) || 0;
        if (amtB !== amtA) return amtB - amtA;
        const dateCmp = (a.transaction_date || '').localeCompare(b.transaction_date || '');
        if (dateCmp !== 0) return dateCmp;
        const timeA = a.transaction_time || '';
        const timeB = b.transaction_time || '';
        if (timeA && !timeB) return -1;
        if (!timeA && timeB) return 1;
        return timeA.localeCompare(timeB);
      } else {
        const dateA = a.transaction_date || '';
        const dateB = b.transaction_date || '';
        const cmp = dateA.localeCompare(dateB);
        if (cmp !== 0) return cmp;
        const timeA = a.transaction_time || '';
        const timeB = b.transaction_time || '';
        if (timeA && !timeB) return -1;
        if (!timeA && timeB) return 1;
        const timeCmp = timeA.localeCompare(timeB);
        if (timeCmp !== 0) return timeCmp;
        return (a.id || 0) - (b.id || 0);
      }
    });
  });

  viewingStatement = computed(() => {
    const id = this.routeId();
    if (!id) return null;
    return this.statements().find((s: any) => s.id === id) || null;
  });

  isDetailsReady = computed(() => {
    const id = this.routeId();
    if (!id) return true;
    if (this.isLoading() || this.isLoadingDetails()) return false;
    const st = this.viewingStatement();
    const details = this.viewingDetailsData();
    if (!st || !details) return false;
    if (this.loadedStatementId() !== id) return false;
    return true;
  });

  selectedAccountId = signal<number | null>(null);

  private statementsByAccountMap = computed(() => {
    const map = new Map<number, any[]>();
    for (const s of this.statements()) {
      const accId = Number(s.account_id);
      let list = map.get(accId);
      if (!list) {
        list = [];
        map.set(accId, list);
      }
      list.push(s);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (b.closing_date || '').localeCompare(a.closing_date || ''));
    }
    return map;
  });

  private latestStatementsByAccountMap = computed(() => {
    const map = new Map<number, any[]>();
    for (const [accId, list] of this.statementsByAccountMap().entries()) {
      map.set(accId, list.slice(0, 3));
    }
    return map;
  });

  filteredStatements = computed(() => {
    const accId = this.selectedAccountId();
    if (!accId) return [];
    return this.statementsByAccountMap().get(Number(accId)) ?? [];
  });

  stForm: FormGroup;
  editingStId = signal<number | null>(null);
  deleteTarget = signal<any>(null);

  isSubmitting = signal(false);
  formError = signal('');

  commentControl = new FormControl('');
  commentTarget = signal<any>(null);
  isSubmittingComment = signal(false);
  commentError = signal('');

  activeTooltip = signal<{
    text: string;
    y: number;
    isBottom: boolean;
    align: 'center' | 'right' | 'left';
    left?: number;
    right?: number;
    arrowOffset?: number;
  } | null>(null);
  isTooltipClosing = signal<boolean>(false);
  isTouchTooltip = signal<boolean>(false);
  private hideTooltipTimeout: any = null;

  @HostListener('window:wheel')
  @HostListener('document:click')
  onDismissTooltip() {
    this.hideCommentTooltip();
  }

  showCommentTooltip(text: string, event: MouseEvent | TouchEvent, isTouch = false) {
    if (this.hideTooltipTimeout) {
      clearTimeout(this.hideTooltipTimeout);
      this.hideTooltipTimeout = null;
    }
    const target = event.currentTarget as HTMLElement;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const btnCenterX = rect.left + rect.width / 2;
    const btnCenterRight = winWidth - btnCenterX;
    const isBottom = rect.top < 60;
    const y = Math.round(isBottom ? rect.bottom + 6 : rect.top - 6);

    let align: 'center' | 'right' | 'left' = 'center';
    let left: number | undefined;
    let right: number | undefined;
    let arrowOffset: number | undefined;

    if (btnCenterRight < 150) {
      align = 'right';
      const rightEdge = Math.max(12, Math.round(winWidth - rect.right - 4));
      right = rightEdge;
      arrowOffset = Math.max(10, Math.round(btnCenterRight - rightEdge - 4));
    } else if (btnCenterX < 150) {
      align = 'left';
      const leftEdge = Math.max(12, Math.round(rect.left - 4));
      left = leftEdge;
      arrowOffset = Math.max(10, Math.round(btnCenterX - leftEdge - 4));
    } else {
      align = 'center';
      left = Math.round(btnCenterX);
    }

    this.activeTooltip.set({
      text,
      y,
      isBottom,
      align,
      left,
      right,
      arrowOffset
    });
    this.isTooltipClosing.set(false);
    this.isTouchTooltip.set(isTouch);
  }

  hideCommentTooltip() {
    if (!this.activeTooltip() || this.isTooltipClosing()) return;
    this.isTooltipClosing.set(true);
    if (this.hideTooltipTimeout) {
      clearTimeout(this.hideTooltipTimeout);
    }
    this.hideTooltipTimeout = setTimeout(() => {
      this.activeTooltip.set(null);
      this.isTooltipClosing.set(false);
      this.isTouchTooltip.set(false);
      this.hideTooltipTimeout = null;
    }, 120);
  }

  toggleCommentTooltip(text: string, event: MouseEvent | TouchEvent) {
    if (this.activeTooltip()?.text === text && !this.isTooltipClosing()) {
      this.hideCommentTooltip();
    } else {
      this.showCommentTooltip(text, event, true);
    }
  }

  constructor() {
    this.stForm = this.fb.group({
      start_date: ['', Validators.required],
      closing_date: ['', Validators.required],
      due_date: ['', Validators.required],
      tax_percentage: ['0', [Validators.required]]
    });

    this.stForm.get('tax_percentage')?.valueChanges.subscribe(val => {
      if (val === null || val === '') return;
      const strVal = val.toString();
      let clean = strVal.replace(/[^0-9,]/g, '');
      const parts = clean.split(',');
      if (parts.length > 2) {
        clean = parts[0] + ',' + parts.slice(1).join('');
      }
      if (parts.length >= 2 && parts[1].length > 2) {
        clean = parts[0] + ',' + parts[1].substring(0, 2);
      }
      if (strVal !== clean) {
        this.stForm.get('tax_percentage')?.setValue(clean, { emitEvent: false });
      }
    });
  }

  defaultTaxPercentage = signal<number>(0);

  loadStatementItems(id: number, options?: { silent?: boolean }) {
    if (!options?.silent) {
      this.isLoadingDetails.set(true);
      if (this.loadedStatementId() !== id) {
        this.viewingDetailsData.set(null);
      }
    }
    this.api.getStatementItems(id).subscribe({
      next: (data) => {
        this.viewingDetailsData.set(data);
        this.loadedStatementId.set(id);
        this.isLoadingDetails.set(false);
      },
      error: (err) => {
        console.error('Error loading statement items', err);
        this.isLoadingDetails.set(false);
      }
    });
  }

  ngOnInit() {
    const unregister = this.refreshService.register(() => this.loadData({ silent: true }));
    this.destroyRef.onDestroy(unregister);

    if (typeof window !== 'undefined') {
      const onScroll = () => this.hideCommentTooltip();
      window.addEventListener('scroll', onScroll, true);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', onScroll, true);
        if (this.hideTooltipTimeout) clearTimeout(this.hideTooltipTimeout);
      });
    }

    this.route.paramMap.subscribe(params => {
      const idStr = params.get('id');
      const accIdStr = params.get('accountId');

      if (idStr) {
        const id = parseInt(idStr, 10);
        this.routeId.set(id);
        this.routeAccountId.set(null);
        this.expensesSort.set('oldest');
        if (this.loadedStatementId() !== id || !this.viewingDetailsData()) {
          this.loadStatementItems(id);
        }
      } else if (accIdStr) {
        this.routeId.set(null);
        this.routeAccountId.set(parseInt(accIdStr, 10));
        this.selectedAccountId.set(parseInt(accIdStr, 10));
        this.viewingDetailsData.set(null);
        this.loadedStatementId.set(null);
      } else {
        this.routeId.set(null);
        this.routeAccountId.set(null);
        this.viewingDetailsData.set(null);
        this.loadedStatementId.set(null);
      }
    });

    this.loadData();
  }

  loadData(options?: { silent?: boolean }): Promise<void> {
    if (!options?.silent) {
      this.isLoading.set(true);
    } else {
      this.api.invalidateCache?.('config', 'entities', 'categories', 'accounts');
    }

    return new Promise((resolve) => {
      forkJoin({
        config: this.api.getConfig().pipe(catchError(() => of({}))),
        ents: this.api.getEntities().pipe(catchError(() => of([]))),
        cats: this.api.getCategories().pipe(catchError(() => of([]))),
        accs: this.api.getAccounts().pipe(catchError(() => of([]))),
        sts: this.api.getStatements().pipe(catchError(() => of([])))
      }).subscribe({
        next: ({ config, ents, cats, accs, sts }) => {
          if (config && (config as any).timezone) this.appTimezone.set((config as any).timezone);
          if (config && (config as any).statement_grace_days !== undefined) this.graceDays.set((config as any).statement_grace_days);
          if (config && (config as any).default_tax_percentage !== undefined) this.defaultTaxPercentage.set((config as any).default_tax_percentage);
          this.entities.set(ents || []);
          this.categories.set(cats || []);
          this.accounts.set((accs || []).filter((a: any) => a.account_type === 'CREDIT_CARD'));
          this.statements.set(sts || []);

          const currentRouteId = this.routeId();
          if (currentRouteId && options?.silent) {
            this.loadStatementItems(currentRouteId, { silent: true });
          }

          if (!options?.silent) {
            this.isLoading.set(false);
          }
          this.hasLoadedOnce.set(true);
          resolve();
        },
        error: () => {
          if (!options?.silent) {
            this.isLoading.set(false);
          }
          this.hasLoadedOnce.set(true);
          resolve();
        }
      });
    });
  }

  loadStatements() {
    this.api.getStatements().subscribe(sts => this.statements.set(sts));
  }

  onAccountChange(event: any) {
    this.selectedAccountId.set(parseInt(event.target.value));
  }

  openModal(st?: any, accountIdForNew?: number) {
    this.formError.set('');
    if (st) {
      this.editingStId.set(st.id);
      this.selectedAccountId.set(st.account_id);
      this.stForm.patchValue({
        start_date: st.start_date,
        closing_date: st.closing_date,
        due_date: st.due_date,
        tax_percentage: (st.tax_percentage || 0).toString().replace('.', ',')
      });
    } else {
      this.editingStId.set(null);
      if (accountIdForNew) {
        this.selectedAccountId.set(accountIdForNew);
      }

      let nextStartDate = '';
      if (this.filteredStatements().length > 0) {
        const lastSt = this.filteredStatements()[0];
        const parts = lastSt.closing_date.split('-');
        const lastClosingDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        lastClosingDate.setDate(lastClosingDate.getDate() + 1);
        const y = lastClosingDate.getFullYear();
        const m = (lastClosingDate.getMonth() + 1).toString().padStart(2, '0');
        const d = lastClosingDate.getDate().toString().padStart(2, '0');
        nextStartDate = `${y}-${m}-${d}`;
      }

      this.stForm.patchValue({
        start_date: nextStartDate,
        closing_date: '',
        due_date: '',
        tax_percentage: this.defaultTaxPercentage().toString().replace('.', ',')
      });
    }
    (document.getElementById('st_modal') as HTMLDialogElement).showModal();
  }

  closeModal() {
    (document.getElementById('st_modal') as HTMLDialogElement).close();
  }

  stepTaxStatement(step: number) {
    const currentStr = this.stForm.get('tax_percentage')?.value?.toString() || '0';
    let currentNum = parseFloat(currentStr.replace(',', '.'));
    if (isNaN(currentNum)) currentNum = 0;

    let newVal = currentNum + step;
    if (newVal < 0) newVal = 0;

    newVal = Math.round(newVal * 100) / 100;
    this.stForm.get('tax_percentage')?.setValue(newVal.toString().replace('.', ','));
  }

  onSubmit() {
    if (this.stForm.invalid || !this.selectedAccountId()) return;
    this.isSubmitting.set(true);
    this.formError.set('');

    const payload = { ...this.stForm.value, account_id: this.selectedAccountId() };
    if (payload.tax_percentage) {
      payload.tax_percentage = parseFloat(payload.tax_percentage.toString().replace(',', '.'));
    }

    const obs = this.editingStId()
      ? this.api.updateStatement(this.editingStId()!, payload)
      : this.api.createStatement(payload);

    obs.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeModal();
        this.loadStatements();
      },
      error: (err: any) => {
        this.isSubmitting.set(false);
        this.formError.set(err.error?.detail || 'Error al guardar el resumen.');
      }
    });
  }

  confirmDelete(st: any) {
    this.deleteTarget.set(st);
    (document.getElementById('confirm_st_modal') as HTMLDialogElement).showModal();
  }

  closeConfirmModal() {
    (document.getElementById('confirm_st_modal') as HTMLDialogElement).close();
  }

  executeDelete() {
    const target = this.deleteTarget();
    if (!target) return;

    this.isSubmitting.set(true);
    this.api.deleteStatement(target.id).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeConfirmModal();
        this.loadStatements();
        if (this.routeId() === target.id) {
          this.router.navigate(['/statements']);
        }
      },
      error: (err: any) => {
        this.isSubmitting.set(false);
        this.closeConfirmModal();
        alert(err.error?.detail || 'Error al eliminar');
      }
    });
  }

  getLatestStatementsForAccount(accountId: number): any[] {
    return this.latestStatementsByAccountMap().get(Number(accountId)) ?? [];
  }

  viewAccount(accountId: number) {
    this.router.navigate(['/statements/account', accountId]);
  }

  getStatementState(st: any): string {
    if (!st) return '';
    if (st.is_paid) return 'PAID';

    if (this.todayInTimezone() > st.closing_date) {
      return 'CLOSED';
    }
    return 'OPEN';
  }

  translateState(state: string) {
    if (state === 'OPEN') return 'Abierto';
    if (state === 'CLOSED') return 'Cerrado (Pendiente)';
    if (state === 'PAID') return 'Pagado';
    return state;
  }

  markAsPaid(st: any) {
    this.isSubmitting.set(true);
    this.api.updateStatement(st.id, { is_paid: true }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.loadStatements();
      },
      error: (err: any) => {
        this.isSubmitting.set(false);
        alert(err.error?.detail || 'Error al marcar como pagado');
      }
    });
  }

  markAsUnpaid(st: any) {
    this.isSubmitting.set(true);
    this.api.updateStatement(st.id, { is_paid: false }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.loadStatements();
      },
      error: (err: any) => {
        this.isSubmitting.set(false);
        alert(err.error?.detail || 'Error al marcar como no pagado');
      }
    });
  }

  getEntityName(entityId: number): string {
    const name = this.entityMap().get(Number(entityId));
    return name ? `${name} - ` : '';
  }

  getEntityOnlyName(entityId?: number | null): string {
    if (!entityId) return '';
    return this.entityMap().get(Number(entityId)) ?? '';
  }

  getStatementPeriod(startDateStr: string | undefined, closingDateStr: string | undefined): string {
    if (!startDateStr || !closingDateStr) return '';

    const cacheKey = `${startDateStr}|${closingDateStr}`;
    const cached = this.statementPeriodCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(closingDateStr + 'T00:00:00');

    if (start > end) {
      this.statementPeriodCache.set(cacheKey, '');
      return '';
    }

    const monthCounts: Record<string, number> = {};

    const current = new Date(start);
    while (current <= end) {
      const key = `${current.getFullYear()}-${current.getMonth()}`;
      monthCounts[key] = (monthCounts[key] || 0) + 1;
      current.setDate(current.getDate() + 1);
    }

    let maxDays = 0;
    let maxKey = '';

    for (const [key, count] of Object.entries(monthCounts)) {
      if (count > maxDays) {
        maxDays = count;
        maxKey = key;
      }
    }

    if (!maxKey) {
      this.statementPeriodCache.set(cacheKey, '');
      return '';
    }

    const [y, m] = maxKey.split('-');
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const result = `${months[parseInt(m)]} ${y}`;
    this.statementPeriodCache.set(cacheKey, result);
    return result;
  }

  toggleExpensesSort() {
    this.expensesSort.update(curr => curr === 'oldest' ? 'amount' : 'oldest');
  }

  viewStatement(st: any) {
    this.expensesSort.set('oldest');
    this.loadStatementItems(st.id);
    this.router.navigate(['/statements', st.id]);
  }

  closeView() {
    this.location.back();
  }

  getViewingDetails() {
    return this.sortedViewingDetails();
  }

  getStatementSubtotal(st: any): number {
    if (this.viewingDetailsData() && this.viewingStatement()?.id === st?.id) {
      return this.viewingDetailsData()!.subtotal;
    }
    return 0;
  }

  getStatementTaxAmount(st: any): number {
    if (this.viewingDetailsData() && this.viewingStatement()?.id === st?.id) {
      return this.viewingDetailsData()!.tax_amount;
    }
    return 0;
  }

  getStatementTotal(st: any): number {
    if (this.viewingDetailsData() && this.viewingStatement()?.id === st?.id) {
      return this.viewingDetailsData()!.total_amount;
    }
    return 0;
  }

  getCategoryName(catId: number): string {
    return this.categoryMap().get(Number(catId))?.name ?? 'Sin categoría';
  }

  getCategoryColor(catId: number): string {
    return this.categoryMap().get(Number(catId))?.color ?? '#e5e7eb';
  }

  getTextColorForBackground(hexColor: string): string {
    return getContrastColor(hexColor);
  }

  canPostpone(inst: any, st: any): boolean {
    if (inst.installment_number !== 1) return false;
    if (inst.postponed_months > 0) return false;

    const txDate = new Date(inst.transaction_date + 'T00:00:00');
    const closingDate = new Date(st.closing_date + 'T00:00:00');
    const diffTime = closingDate.getTime() - txDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));

    return diffDays >= 0 && diffDays <= this.graceDays();
  }

  canRevertPostpone(inst: any, st: any): boolean {
    if (inst.installment_number !== 1) return false;
    return inst.postponed_months > 0;
  }

  postponeTargetIsForward = signal<boolean>(true);
  postponeTargetInst = signal<any>(null);
  isSubmittingPostpone = signal<boolean>(false);

  postponeTransaction(inst: any, postpone: boolean) {
    this.postponeTargetInst.set(inst);
    this.postponeTargetIsForward.set(postpone);
    const modal = document.getElementById('confirm_postpone_modal') as HTMLDialogElement;
    if (typeof modal?.showModal === 'function') {
      modal.showModal();
    }
  }

  closePostponeModal() {
    if (this.isSubmittingPostpone()) return;
    const modal = document.getElementById('confirm_postpone_modal') as HTMLDialogElement;
    if (typeof modal?.close === 'function') {
      modal.close();
    }
  }

  async executePostpone() {
    const inst = this.postponeTargetInst();
    if (!inst || this.isSubmittingPostpone()) return;

    this.isSubmitting.set(true);
    this.isSubmittingPostpone.set(true);
    const minDurationPromise = new Promise(resolve => setTimeout(resolve, 300));
    let errorMessage: string | null = null;

    try {
      await firstValueFrom(this.api.postponeTransaction(inst.id, this.postponeTargetIsForward()));
      const id = this.routeId();
      if (id) {
        try {
          const data = await firstValueFrom(this.api.getStatementItems(id));
          this.viewingDetailsData.set(data);
          this.loadedStatementId.set(id);
        } catch (err) {
          console.error('Error reloading statement items:', err);
        }
      }
      this.loadStatements();
    } catch (err: any) {
      console.error('Error postponing transaction:', err);
      errorMessage = err.error?.detail || 'Error al mover el gasto';
    } finally {
      await minDurationPromise;
      this.isSubmitting.set(false);
      this.isSubmittingPostpone.set(false);
      this.closePostponeModal();
      if (errorMessage) {
        alert(errorMessage);
      }
    }
  }

  hasComment(st: any): boolean {
    return Boolean(st?.comment && st.comment.trim().length > 0);
  }

  openCommentModal(st: any) {
    if (!st) return;
    this.commentTarget.set(st);
    this.commentControl.setValue(st.comment || '');
    this.commentError.set('');
    const modal = document.getElementById('comment_modal') as any;
    if (typeof modal?.showModal === 'function') {
      modal.showModal();
    }
  }

  closeCommentModal() {
    this.commentError.set('');
    const modal = document.getElementById('comment_modal') as any;
    if (typeof modal?.close === 'function') {
      modal.close();
    }
  }

  saveComment() {
    const target = this.commentTarget();
    if (!target) return;

    const trimmed = this.commentControl.value?.trim() || null;
    this.isSubmittingComment.set(true);
    this.commentError.set('');

    this.api.updateStatement(target.id, { comment: trimmed }).subscribe({
      next: () => {
        this.isSubmittingComment.set(false);
        this.closeCommentModal();
        this.statements.update(list =>
          list.map(s => s.id === target.id ? { ...s, comment: trimmed } : s)
        );
        if (this.viewingDetailsData()) {
          this.viewingDetailsData.update(d => {
            if (!d) return null;
            if ((d as any).statement && (d as any).statement.id === target.id) {
              return { ...d, statement: { ...(d as any).statement, comment: trimmed } };
            }
            return d;
          });
        }
        this.loadStatements();
      },
      error: (err: any) => {
        this.isSubmittingComment.set(false);
        this.commentError.set(err.error?.detail || 'Error al guardar el comentario.');
      }
    });
  }

  deleteComment() {
    const target = this.commentTarget();
    if (!target) return;

    this.isSubmittingComment.set(true);
    this.commentError.set('');

    this.api.updateStatement(target.id, { comment: null }).subscribe({
      next: () => {
        this.isSubmittingComment.set(false);
        this.closeCommentModal();
        this.statements.update(list =>
          list.map(s => s.id === target.id ? { ...s, comment: null } : s)
        );
        if (this.viewingDetailsData()) {
          this.viewingDetailsData.update(d => {
            if (!d) return null;
            if ((d as any).statement && (d as any).statement.id === target.id) {
              return { ...d, statement: { ...(d as any).statement, comment: null } };
            }
            return d;
          });
        }
        this.loadStatements();
      },
      error: (err: any) => {
        this.isSubmittingComment.set(false);
        this.commentError.set(err.error?.detail || 'Error al eliminar el comentario.');
      }
    });
  }
}
