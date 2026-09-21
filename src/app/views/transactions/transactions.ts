import { Component, inject, OnInit, OnDestroy, AfterViewInit, signal, computed } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { getContrastColor } from '../../utils/color';

export const DEFAULT_PAGE_SIZE = 50;
export const SPINNER_DELAY_MS = 250;

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule],
  providers: [DatePipe],
  templateUrl: './transactions.html',
  styleUrl: './transactions.css'
})
export class Transactions implements OnInit, AfterViewInit, OnDestroy {
  protected readonly Math = Math;
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  
  transactions = signal<any[]>([]);
  accounts = signal<any[]>([]);
  categories = signal<any[]>([]);
  entities = signal<any[]>([]);
  
  generalReport = signal<any>(null);
  
  // Pagination & Filtering state
  currentPage = signal<number>(1);
  pageSize = signal<number>(DEFAULT_PAGE_SIZE);
  totalItems = signal<number>(0);
  totalPages = signal<number>(1);
  searchTerm = signal<string>('');
  selectedFilterCategory = signal<number | 'all'>('all');
  
  // Floating scroll-to-top button state
  showScrollTop = signal<boolean>(false);
  private scrollContainer: HTMLElement | null = null;
  private onScrollHandler = () => this.checkScroll();

  isMobile = signal<boolean>(false);
  private onResizeHandler = () => this.checkIsMobile();
  
  private searchSubject = new Subject<string>();

  groupedTransactions = computed<{ date: string, total: number, items: any[] }[]>(() => {
    const txs = this.transactions();
    
    // Create an object to group by date
    const groupedObj = txs.reduce((acc, tx) => {
      const date = tx.transaction_date;
      if (!acc[date]) {
        acc[date] = { date, total: 0, items: [] };
      }
      acc[date].items.push(tx);
      acc[date].total += tx.total_amount;
      return acc;
    }, {} as Record<string, { date: string, total: number, items: any[] }>);
    
    // Convert back to array, sorting by date descending
    const result = Object.values(groupedObj) as { date: string, total: number, items: any[] }[];
    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return result;
  });
  
  isLoading = signal<boolean>(false);
  showSpinner = signal<boolean>(false);
  hasLoadedOnce = signal<boolean>(false);
  private loadingTimeout: any = null;
  isSubmitting = signal<boolean>(false);
  errorMsg = signal<string>('');
  formError = signal<string>('');
  
  txForm: FormGroup;
  showInstallments = signal<boolean>(false);

  constructor() {
    const today = new Date().toISOString().split('T')[0];
    
    this.txForm = this.fb.group({
      total_amount: ['', [Validators.required]],
      real_amount: [''],
      description: [''],
      account_id: ['', Validators.required],
      installments_count: [1],
      category_id: ['', Validators.required],
      transaction_date: [today, Validators.required],
      transaction_time: ['']
    });

    this.txForm.get('account_id')?.valueChanges.subscribe(val => {
      const acc = this.accounts().find(a => a.id == val);
      if (acc && acc.account_type === 'CREDIT_CARD') {
        this.showInstallments.set(true);
      } else {
        this.showInstallments.set(false);
        this.txForm.patchValue({ installments_count: 1 }, { emitEvent: false });
      }
    });

    this.txForm.get('installments_count')?.valueChanges.subscribe(val => {
      if (val === null || val === '') return;
      const strVal = val.toString();
      const clean = strVal.replace(/[^0-9]/g, '');
      if (strVal !== clean) {
        this.txForm.get('installments_count')?.setValue(clean, { emitEvent: false });
      }
    });
  }

  defaultAccountId = signal<number | null>(null);

  appTimezone = signal<string>('America/Argentina/Buenos_Aires');

  ngOnInit() {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.searchTerm.set(term);
      this.currentPage.set(1);
      this.loadTransactions();
    });

    this.loadTransactions();
    this.loadGeneralReport();
    
    // Load dropdown data
    this.api.getConfig().subscribe(c => {
      this.defaultAccountId.set(c.default_account_id);
      this.appTimezone.set(c.timezone || 'America/Argentina/Buenos_Aires');
    });
    this.api.getAccounts().subscribe(a => this.accounts.set(a));
    this.api.getEntities().subscribe(e => this.entities.set(e));
    this.api.getCategories().subscribe(c => this.categories.set(c));

    this.txForm.get('total_amount')?.valueChanges.subscribe(val => {
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
      
      const newParts = clean.split(',');
      if (newParts[0]) {
        newParts[0] = newParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      }
      
      const formatted = newParts.join(',');
      
      if (strVal !== formatted) {
        this.txForm.get('total_amount')?.setValue(formatted, { emitEvent: false });
      }
    });

    this.txForm.get('real_amount')?.valueChanges.subscribe(val => {
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
      
      const newParts = clean.split(',');
      if (newParts[0]) {
        newParts[0] = newParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      }
      
      const formatted = newParts.join(',');
      
      if (strVal !== formatted) {
        this.txForm.get('real_amount')?.setValue(formatted, { emitEvent: false });
      }
    });

    this.checkIsMobile();

    this.txForm.get('transaction_time')?.valueChanges.subscribe(val => {
      if (!val || this.isMobile()) return;
      let clean = val.replace(/[^0-9:]/g, '');
      
      if (clean.length === 2 && val.length === 2 && !clean.includes(':')) {
        clean += ':';
      }
      if (clean.length > 5) {
        clean = clean.substring(0, 5);
      }
      
      if (val !== clean) {
        this.txForm.get('transaction_time')?.setValue(clean, { emitEvent: false });
      }
    });
  }

  checkIsMobile() {
    if (typeof window !== 'undefined') {
      this.isMobile.set(window.innerWidth < 768);
    }
  }

  loadGeneralReport() {
    this.api.getGeneralReport().subscribe({
      next: (report) => this.generalReport.set(report),
      error: (err) => console.error("Error loading general report:", err)
    });
  }

  ngAfterViewInit() {
    if (typeof document !== 'undefined') {
      this.scrollContainer = document.querySelector('main');
      if (this.scrollContainer) {
        this.scrollContainer.addEventListener('scroll', this.onScrollHandler, { passive: true });
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this.onScrollHandler, { passive: true });
      window.addEventListener('resize', this.onResizeHandler, { passive: true });
    }
    this.checkScroll();
    this.checkIsMobile();
  }

  ngOnDestroy() {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }
    if (this.scrollContainer && typeof this.scrollContainer.removeEventListener === 'function') {
      this.scrollContainer.removeEventListener('scroll', this.onScrollHandler);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.onScrollHandler);
      window.removeEventListener('resize', this.onResizeHandler);
    }
  }

  checkScroll() {
    const mainScroll = this.scrollContainer ? this.scrollContainer.scrollTop : 0;
    const windowScroll = (typeof window !== 'undefined') ? (window.scrollY || document.documentElement.scrollTop || 0) : 0;
    this.showScrollTop.set(mainScroll > 200 || windowScroll > 200);
  }

  scrollToTop(duration: number = 200) {
    const startMain = this.scrollContainer ? this.scrollContainer.scrollTop : 0;
    const startWindow = (typeof window !== 'undefined') ? (window.scrollY || document.documentElement.scrollTop || 0) : 0;
    
    if (startMain <= 0 && startWindow <= 0) return;

    if (duration <= 0 || typeof requestAnimationFrame === 'undefined') {
      if (this.scrollContainer) {
        this.scrollContainer.scrollTop = 0;
      }
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0);
      }
      return;
    }

    const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const easeOutCubic = (t: number) => (--t) * t * t + 1;

    const animateScroll = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = easeOutCubic(progress);

      if (this.scrollContainer && startMain > 0) {
        this.scrollContainer.scrollTop = Math.round(startMain * (1 - ease));
      }
      if (typeof window !== 'undefined') {
        window.scrollTo(0, Math.round(startWindow * (1 - ease)));
      }

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };

    requestAnimationFrame(animateScroll);
  }

  loadTransactions(silent: boolean = false) {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }

    if (!silent) {
      this.isLoading.set(true);
      this.loadingTimeout = setTimeout(() => {
        if (this.isLoading()) {
          this.showSpinner.set(true);
        }
      }, SPINNER_DELAY_MS);
    }

    this.api.getTransactions({
      page: this.currentPage(),
      limit: this.pageSize(),
      search: this.searchTerm(),
      category_id: this.selectedFilterCategory()
    }).subscribe({
      next: (res) => {
        if (this.loadingTimeout) {
          clearTimeout(this.loadingTimeout);
          this.loadingTimeout = null;
        }
        const items = res.items || [];
        this.transactions.set(items);
        this.totalItems.set(res.total || 0);
        this.totalPages.set(res.total_pages || 1);
        this.currentPage.set(res.page || 1);
        this.hasLoadedOnce.set(true);
        if (!silent) {
          this.isLoading.set(false);
          this.showSpinner.set(false);
        }
      },
      error: (err) => {
        if (this.loadingTimeout) {
          clearTimeout(this.loadingTimeout);
          this.loadingTimeout = null;
        }
        console.error(err);
        this.errorMsg.set('Error loading transactions.');
        this.hasLoadedOnce.set(true);
        if (!silent) {
          this.isLoading.set(false);
          this.showSpinner.set(false);
        }
      }
    });
  }

  onSearchChange(term: string) {
    this.searchSubject.next(term);
  }

  clearSearch() {
    this.searchTerm.set('');
    this.searchSubject.next('');
    this.currentPage.set(1);
    this.loadTransactions();
  }

  onCategoryChange(catId: any) {
    this.selectedFilterCategory.set(catId);
    this.currentPage.set(1);
    this.loadTransactions();
  }

  resetFilters() {
    this.searchTerm.set('');
    this.searchSubject.next('');
    this.selectedFilterCategory.set('all');
    this.currentPage.set(1);
    this.loadTransactions();
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }
    this.currentPage.set(page);
    this.loadTransactions();
  }

  editingTxId = signal<number | null>(null);
  deleteTarget = signal<any>(null);

  openModal(tx?: any) {
    this.checkIsMobile();
    this.formError.set('');
    
    if (tx) {
      this.editingTxId.set(tx.id);
      
      // Convert float back to string with comma for the mask
      let formattedAmount = tx.total_amount.toString().replace('.', ',');
      if (formattedAmount.indexOf(',') === -1 && tx.total_amount % 1 !== 0) {
          // just in case
      }
      
      let formattedRealAmount = '';
      if (tx.real_amount !== null && tx.real_amount !== undefined) {
        formattedRealAmount = tx.real_amount.toString().replace('.', ',');
      }
      
      this.txForm.patchValue({
        total_amount: formattedAmount,
        real_amount: formattedRealAmount,
        description: tx.description || '',
        account_id: tx.account_id,
        category_id: tx.category_id || '',
        installments_count: tx.installments_count || 1,
        transaction_date: tx.transaction_date,
        transaction_time: tx.transaction_time ? tx.transaction_time.substring(0, 5) : ''
      });

      const acc = this.accounts().find(a => a.id == tx.account_id);
      this.showInstallments.set(acc?.account_type === 'CREDIT_CARD');
    } else {
      this.editingTxId.set(null);
      const tz = this.appTimezone();
      const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
      
      this.txForm.reset({
        total_amount: '',
        real_amount: '',
        description: '',
        account_id: this.defaultAccountId() || '',
        category_id: '',
        installments_count: 1,
        transaction_date: today,
        transaction_time: ''
      });
    }
    
    const modal = document.getElementById('tx_modal') as HTMLDialogElement;
    modal.showModal();
    
    // Evitar que se abra el teclado en móvil al editar
    if (this.isMobile() && tx) {
      setTimeout(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }, 0);
    }
  }

  closeModal() {
    (document.getElementById('tx_modal') as HTMLDialogElement).close();
  }
  
  closeConfirmModal() {
    (document.getElementById('confirm_modal') as HTMLDialogElement).close();
  }

  getSelectedAccountDisplay(): string {
    const val = this.txForm?.get('account_id')?.value;
    if (!val) return 'Selecciona una cuenta';
    const acc = this.accounts().find(a => a.id == val);
    if (!acc) return 'Selecciona una cuenta';
    if (this.isMobile()) {
      return acc.name;
    }
    return `${this.getEntityName(acc.entity_id)} - ${acc.name}`;
  }

  getEntityName(entityId: number): string {
    const ent = this.entities().find(e => e.id === entityId);
    return ent ? ent.name : 'Desconocido';
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
    return getContrastColor(hexColor);
  }

  stepInstallments(step: number) {
    let current = parseInt(this.txForm.get('installments_count')?.value, 10);
    if (isNaN(current)) current = 1;
    current += step;
    if (current < 1) current = 1;
    this.txForm.patchValue({ installments_count: current });
  }

  onSubmit() {
    if (this.txForm.invalid) {
      this.formError.set('Por favor, completa los campos requeridos correctamente.');
      return;
    }
    
    this.isSubmitting.set(true);
    this.formError.set('');
    
    const payload = { ...this.txForm.value };
    if (!payload.description) delete payload.description;

    payload.installments_count = parseInt(payload.installments_count?.toString() || '1', 10);
    if (isNaN(payload.installments_count) || payload.installments_count < 1) {
      payload.installments_count = 1;
    }
    
    // Parse formatted string back to float
    const rawAmount = payload.total_amount.toString();
    payload.total_amount = parseFloat(rawAmount.replace(/\./g, '').replace(',', '.'));
    
    if (payload.real_amount !== null && payload.real_amount !== undefined && payload.real_amount !== '') {
      const rawRealAmount = payload.real_amount.toString();
      payload.real_amount = parseFloat(rawRealAmount.replace(/\./g, '').replace(',', '.'));
    } else {
      payload.real_amount = null;
    }
    
    if (payload.transaction_time) {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(payload.transaction_time)) {
        this.formError.set('La hora debe estar en un formato válido de 24hs (Ej: 14:30).');
        this.isSubmitting.set(false);
        return;
      }
      payload.transaction_time += ':00';
    } else {
      delete payload.transaction_time;
    }
    
    payload.currency = 'ARS';
    
    const isEdit = !!this.editingTxId();
    const obs = isEdit
      ? this.api.updateTransaction(this.editingTxId()!, payload)
      : this.api.createTransaction(payload);
      
    obs.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeModal();
        if (!isEdit) {
          this.currentPage.set(1);
        }
        this.loadTransactions(true);
        this.loadGeneralReport();
      },
      error: (err) => {
        console.error(err);
        this.isSubmitting.set(false);
        const detail = err.error?.detail;
        let msg = 'Error al guardar el gasto.';
        if (typeof detail === 'string') {
          msg = detail;
        } else if (Array.isArray(detail)) {
          msg = detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
        } else if (err.error?.message) {
          msg = err.error.message;
        }
        this.formError.set(msg);
      }
    });
  }

  confirmDeleteTx(tx: any) {
    this.deleteTarget.set(tx);
    (document.getElementById('confirm_modal') as HTMLDialogElement).showModal();
  }

  executeDelete() {
    const target = this.deleteTarget();
    if (!target) return;
    
    this.isSubmitting.set(true);
    this.api.deleteTransaction(target.id).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeConfirmModal();
        if (this.transactions().length === 1 && this.currentPage() > 1) {
          this.currentPage.update(p => p - 1);
        }
        this.loadTransactions(true);
        this.loadGeneralReport();
        this.deleteTarget.set(null);
      },
      error: (err) => {
        console.error(err);
        this.isSubmitting.set(false);
        this.closeConfirmModal();
        alert(err.error?.detail || 'Error al eliminar el gasto');
      }
    });
  }
}
