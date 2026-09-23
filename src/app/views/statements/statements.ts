import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, Location } from '@angular/common';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-statements',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './statements.html'
})
export class Statements implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  accounts = signal<any[]>([]);
  statements = signal<any[]>([]);
  entities = signal<any[]>([]);
  transactions = signal<any[]>([]);
  installments = signal<any[]>([]);
  categories = signal<any[]>([]);
  appTimezone = signal<string>('America/Argentina/Buenos_Aires');
  graceDays = signal<number>(10);
  
  isLoading = signal<boolean>(true);
  
  routeId = signal<number | null>(null);
  routeAccountId = signal<number | null>(null);
  viewingDetailsData = signal<{ items: any[], subtotal: number, tax_amount: number, total_amount: number } | null>(null);
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
        return (a.transaction_date || '').localeCompare(b.transaction_date || '');
      } else {
        const dateA = a.transaction_date || '';
        const dateB = b.transaction_date || '';
        const cmp = dateA.localeCompare(dateB);
        if (cmp !== 0) return cmp;
        return (a.id || 0) - (b.id || 0);
      }
    });
  });
  
  viewingStatement = computed(() => {
    const id = this.routeId();
    if (!id) return null;
    return this.statements().find((s: any) => s.id === id) || null;
  });
  
  selectedAccountId = signal<number | null>(null);
  
  filteredStatements = computed(() => {
    const accId = this.selectedAccountId();
    if (!accId) return [];
    return this.statements().filter(s => s.account_id == accId).sort((a, b) => new Date(b.closing_date).getTime() - new Date(a.closing_date).getTime());
  });

  stForm: FormGroup;
  editingStId = signal<number | null>(null);
  deleteTarget = signal<any>(null);
  
  isSubmitting = signal(false);
  formError = signal('');
  
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

  loadStatementItems(id: number) {
    this.api.getStatementItems(id).subscribe({
      next: (data) => this.viewingDetailsData.set(data),
      error: (err) => console.error('Error loading statement items', err)
    });
  }

  ngOnInit() {
    this.isLoading.set(true);
    
    this.route.paramMap.subscribe(params => {
      const idStr = params.get('id');
      const accIdStr = params.get('accountId');
      
      if (idStr) {
        const id = parseInt(idStr, 10);
        this.routeId.set(id);
        this.routeAccountId.set(null);
        this.expensesSort.set('oldest');
        this.loadStatementItems(id);
      } else if (accIdStr) {
        this.routeId.set(null);
        this.routeAccountId.set(parseInt(accIdStr, 10));
        this.selectedAccountId.set(parseInt(accIdStr, 10));
      } else {
        this.routeId.set(null);
        this.routeAccountId.set(null);
      }
    });

    forkJoin({
      config: this.api.getConfig(),
      ents: this.api.getEntities(),
      cats: this.api.getCategories(),
      accs: this.api.getAccounts(),
      sts: this.api.getStatements()
    }).subscribe(({ config, ents, cats, accs, sts }) => {
      this.appTimezone.set(config.timezone || 'America/Argentina/Buenos_Aires');
      this.graceDays.set(config.statement_grace_days ?? 10);
      this.defaultTaxPercentage.set(config.default_tax_percentage || 0);
      this.entities.set(ents);
      this.categories.set(cats);
      this.accounts.set(accs.filter((a: any) => a.account_type === 'CREDIT_CARD'));
      this.statements.set(sts);
      
      const currentRouteId = this.routeId();
      if (currentRouteId) {
        this.loadStatementItems(currentRouteId);
      }
      
      this.isLoading.set(false);
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
    let currentStr = this.stForm.get('tax_percentage')?.value?.toString() || '0';
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
    return this.statements()
      .filter(s => s.account_id === accountId)
      .sort((a, b) => new Date(b.closing_date).getTime() - new Date(a.closing_date).getTime())
      .slice(0, 3);
  }

  viewAccount(accountId: number) {
    this.router.navigate(['/statements/account', accountId]);
  }

  getStatementState(st: any): string {
    if (!st) return '';
    if (st.is_paid) return 'PAID';
    
    // Check if closed based on local timezone
    const tz = this.appTimezone();
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });
    if (todayStr > st.closing_date) {
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
    const ent = this.entities().find(e => e.id === entityId);
    return ent ? `${ent.name} - ` : '';
  }

  getEntityOnlyName(entityId?: number | null): string {
    if (!entityId) return '';
    const ent = this.entities().find(e => e.id === entityId);
    return ent ? ent.name : '';
  }

  getStatementPeriod(startDateStr: string | undefined, closingDateStr: string | undefined): string {
    if (!startDateStr || !closingDateStr) return '';
    
    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(closingDateStr + 'T00:00:00');
    
    if (start > end) return '';
    
    const monthCounts: Record<string, number> = {};
    
    let current = new Date(start);
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
    
    if (!maxKey) return '';
    
    const [y, m] = maxKey.split('-');
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${months[parseInt(m)]} ${y}`;
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
    const cat = this.categories().find(c => c.id === catId);
    return cat ? cat.name : 'Sin categoría';
  }
  
  getCategoryColor(catId: number): string {
    const cat = this.categories().find(c => c.id === catId);
    return cat ? cat.color : '#e5e7eb';
  }

  getTextColorForBackground(hexColor: string): string {
    if (!hexColor) return '#1f2937';
    const hex = hexColor.replace('#', '');
    if (hex.length !== 6 && hex.length !== 3) return '#1f2937';
    
    const r = parseInt(hex.length === 3 ? hex.charAt(0) + hex.charAt(0) : hex.substring(0, 2), 16);
    const g = parseInt(hex.length === 3 ? hex.charAt(1) + hex.charAt(1) : hex.substring(2, 4), 16);
    const b = parseInt(hex.length === 3 ? hex.charAt(2) + hex.charAt(2) : hex.substring(4, 6), 16);
    
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128 ? '#1f2937' : '#ffffff';
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

  postponeTransaction(inst: any, postpone: boolean) {
    this.postponeTargetInst.set(inst);
    this.postponeTargetIsForward.set(postpone);
    (document.getElementById('confirm_postpone_modal') as HTMLDialogElement).showModal();
  }
  
  closePostponeModal() {
    (document.getElementById('confirm_postpone_modal') as HTMLDialogElement).close();
  }
  
  executePostpone() {
    const inst = this.postponeTargetInst();
    if (!inst) return;
    
    this.isSubmitting.set(true);
    this.api.postponeTransaction(inst.id, this.postponeTargetIsForward()).subscribe({
      next: () => {
        const id = this.routeId();
        if (id) {
          this.api.getStatementItems(id).subscribe({
            next: (data) => {
              this.viewingDetailsData.set(data);
              this.isSubmitting.set(false);
              this.closePostponeModal();
            },
            error: () => {
              this.isSubmitting.set(false);
              this.closePostponeModal();
            }
          });
        } else {
          this.isSubmitting.set(false);
          this.closePostponeModal();
        }
      },
      error: () => {
        this.isSubmitting.set(false);
        this.closePostponeModal();
      }
    });
  }
}
