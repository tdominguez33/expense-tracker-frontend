import { Component, inject, OnInit, OnDestroy, signal, HostListener, DestroyRef } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { RefreshService } from '../../services/refresh.service';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CATEGORY_COLORS } from '../../constants/colors';
import { getContrastColor } from '../../utils/color';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class Settings implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private refreshService = inject(RefreshService);
  private destroyRef = inject(DestroyRef);
  
  isMobile = signal<boolean>(false);

  categories = signal<any[]>([]);
  accounts = signal<any[]>([]);
  entities = signal<any[]>([]);
  accountsByEntity = signal<any>({});

  
  isLoading = signal<boolean>(true);
  
  timezoneControl = this.fb.control('America/Argentina/Buenos_Aires', Validators.required);
  
  catForm: FormGroup;
  entForm: FormGroup;
  accForm: FormGroup;
  configForm: FormGroup;
  
  isSubmitting = signal<boolean>(false);
  errorMsg = signal<string>('');
  
  // Track currently edited items. Null means creating.
  editingCatId = signal<number | null>(null);
  editingEntId = signal<number | null>(null);
  editingAccId = signal<number | null>(null);

  isDownloadingDb = signal<boolean>(false);
  isImportingDb = signal<boolean>(false);
  selectedImportFile = signal<File | null>(null);
  importError = signal<string>('');
  importSuccessMsg = signal<string>('');

  // Color Picker State
  showAllColors = signal(false);
  pastelColors = CATEGORY_COLORS;

  constructor() {
    this.catForm = this.fb.group({
      name: ['', Validators.required],
      color: [this.pastelColors[0] || '']
    });
    
    this.entForm = this.fb.group({
      name: ['', Validators.required]
    });
    
    this.configForm = this.fb.group({
      default_tax_percentage: [0, Validators.min(0)],
      default_account_id: [null],
      statement_grace_days: [10, Validators.min(0)]
    });
    
    this.accForm = this.fb.group({
      entity_id: ['', Validators.required],
      account_type: ['DEBIT', Validators.required],
      name: ['', Validators.required],
      available_limit: [''],
      apple_wallet_alias: ['']
    });

    this.accForm.get('available_limit')?.valueChanges.subscribe(val => {
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
        this.accForm.get('available_limit')?.setValue(formatted, { emitEvent: false });
      }
    });

    this.configForm.get('default_tax_percentage')?.valueChanges.subscribe(val => {
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
        this.configForm.get('default_tax_percentage')?.setValue(clean, { emitEvent: false });
      }
    });

    this.configForm.get('statement_grace_days')?.valueChanges.subscribe(val => {
      if (val === null || val === '') return;
      const strVal = val.toString();
      const clean = strVal.replace(/[^0-9]/g, '');
      if (strVal !== clean) {
        this.configForm.get('statement_grace_days')?.setValue(clean, { emitEvent: false });
      }
    });

    this.accForm.get('account_type')?.valueChanges.subscribe(val => {
      // Logic for showing/hiding credit fields handled in template
    });
  }

  @HostListener('window:resize')
  onResize() {
    this.checkIsMobile();
  }

  checkIsMobile() {
    if (typeof window !== 'undefined') {
      const isSmallScreen = window.innerWidth < 768;
      const isTouchMobile = window.innerWidth < 1024 && (('ontouchstart' in window) || (navigator?.maxTouchPoints ?? 0) > 0);
      this.isMobile.set(isSmallScreen || isTouchMobile);
    }
  }

  ngOnInit() {
    const unregister = this.refreshService.register(() => this.loadData({ silent: true }));
    this.destroyRef.onDestroy(unregister);

    this.checkIsMobile();
    this.loadData();
  }

  saveTimezone() {
    if (this.timezoneControl.valid && this.timezoneControl.value) {
      this.api.updateConfig({ timezone: this.timezoneControl.value }).subscribe({
        next: () => this.loadData(),
        error: (err) => console.error(err)
      });
    }
  }

  loadData(options?: { silent?: boolean }): Promise<void> {
    if (!options?.silent) {
      this.isLoading.set(true);
    }

    return new Promise((resolve) => {
      forkJoin({
        config: this.api.getConfig().pipe(catchError(() => of({}))),
        cats: this.api.getCategories().pipe(catchError(() => of([]))),
        ents: this.api.getEntities().pipe(catchError(() => of([]))),
        accs: this.api.getAccounts().pipe(catchError(() => of([])))
      }).subscribe({
        next: ({ config: c, cats, ents, accs }) => {
          let taxStr = '';
          if (c && (c as any).default_tax_percentage !== null && (c as any).default_tax_percentage !== undefined) {
            taxStr = (c as any).default_tax_percentage.toString().replace('.', ',');
          }
          this.configForm.patchValue({
            default_tax_percentage: taxStr as any,
            default_account_id: (c as any)?.default_account_id ?? null,
            statement_grace_days: (c as any)?.statement_grace_days ?? 10
          });
          this.timezoneControl.setValue((c as any)?.timezone || 'America/Argentina/Buenos_Aires', { emitEvent: false });
          
          this.categories.set(cats || []);
          this.entities.set(ents || []);
          
          this.accounts.set(accs || []);
          this.loadAccounts(accs || []);
          
          if (!options?.silent) {
            this.isLoading.set(false);
          }
          resolve();
        },
        error: (err) => {
          console.error(err);
          this.errorMsg.set('Error loading settings data.');
          if (!options?.silent) {
            this.isLoading.set(false);
          }
          resolve();
        }
      });
    });
  }
  
  saveConfig() {
    if (this.configForm.invalid) return;
    this.isSubmitting.set(true);
    
    // Parse value before save
    const payload = { ...this.configForm.value };
    if (payload.default_tax_percentage !== null && payload.default_tax_percentage !== undefined && payload.default_tax_percentage !== '') {
      payload.default_tax_percentage = parseFloat(payload.default_tax_percentage.toString().replace(',', '.'));
    }
    if (payload.statement_grace_days !== null && payload.statement_grace_days !== undefined && payload.statement_grace_days !== '') {
      payload.statement_grace_days = parseInt(payload.statement_grace_days.toString(), 10);
    }
    
    this.api.updateConfig(payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
      },
      error: () => {
        this.isSubmitting.set(false);
      }
    });
  }
  
  stepGraceDays(step: number) {
    let current = parseInt(this.configForm.get('statement_grace_days')?.value, 10);
    if (isNaN(current)) current = 0;
    current += step;
    if (current < 0) current = 0;
    this.configForm.patchValue({ statement_grace_days: current });
  }
  
  stepTaxConfig(step: number) {
    let currentStr = this.configForm.get('default_tax_percentage')?.value?.toString() || '0';
    let currentNum = parseFloat(currentStr.replace(',', '.'));
    if (isNaN(currentNum)) currentNum = 0;
    
    let newVal = currentNum + step;
    if (newVal < 0) newVal = 0;
    
    // Fix floating point math issues
    newVal = Math.round(newVal * 100) / 100;
    this.configForm.get('default_tax_percentage')?.setValue(newVal.toString().replace('.', ','));
  }
  
  loadAccounts(accs: any[]) {
    const entMap = new Map<number, string>();
    this.entities().forEach(e => entMap.set(e.id, e.name));
    
    const byEnt: any = {};
    this.entities().forEach(e => byEnt[e.name] = { id: e.id, accounts: [] });
    byEnt['Sin Entidad'] = { id: null, accounts: [] };
    
    accs.forEach((a: any) => {
      const eName = entMap.get(a.entity_id) || 'Sin Entidad';
      if (!byEnt[eName]) byEnt[eName] = { id: a.entity_id, accounts: [] };
      byEnt[eName].accounts.push(a);
    });
    
    this.accountsByEntity.set(byEnt);
  }
  
  // -- Drag & Drop Categories --
  draggedCatIndex = signal<number | null>(null);

  onDragStartCat(index: number, event: DragEvent) {
    this.draggedCatIndex.set(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDragOverCat(event: DragEvent) {
    event.preventDefault(); // Necessary to allow dropping
  }

  onDropCat(index: number, event: DragEvent) {
    event.preventDefault();
    const draggedIdx = this.draggedCatIndex();
    if (draggedIdx !== null && draggedIdx !== index) {
      const cats = [...this.categories()];
      const movedItem = cats.splice(draggedIdx, 1)[0];
      cats.splice(index, 0, movedItem);
      
      this.categories.set(cats);
      
      const orders = cats.map((cat, idx) => ({ id: cat.id, sort_order: idx }));
      this.api.reorderCategories(orders).subscribe();
    }
    this.draggedCatIndex.set(null);
  }
  
  onDragEndCat() {
    this.draggedCatIndex.set(null);
  }

  // -- Touch Drag & Drop Categories (Mobile Long-Press) --
  touchDraggedCatIndex = signal<number | null>(null);
  private touchStartX = 0;
  private touchStartY = 0;
  private longPressTimeout: any = null;
  private isTouchDragging = false;

  onTouchStartCat(index: number, event: TouchEvent) {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.isTouchDragging = false;

    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout);
    }

    this.longPressTimeout = setTimeout(() => {
      this.isTouchDragging = true;
      this.touchDraggedCatIndex.set(index);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate?.(40);
        } catch {}
      }
    }, 280);
  }

  onTouchMoveCat(event: TouchEvent) {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];

    if (!this.isTouchDragging) {
      const moveDistance = Math.hypot(touch.clientX - this.touchStartX, touch.clientY - this.touchStartY);
      if (moveDistance > 8) {
        if (this.longPressTimeout) {
          clearTimeout(this.longPressTimeout);
          this.longPressTimeout = null;
        }
      }
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    const currentIdx = this.touchDraggedCatIndex();
    if (currentIdx === null) return;

    if (typeof document !== 'undefined') {
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetLi = elem?.closest('[data-cat-index]');
      if (targetLi) {
        const targetIdx = parseInt(targetLi.getAttribute('data-cat-index') || '', 10);
        if (!isNaN(targetIdx) && targetIdx !== currentIdx && targetIdx >= 0 && targetIdx < this.categories().length) {
          const cats = [...this.categories()];
          const [movedItem] = cats.splice(currentIdx, 1);
          cats.splice(targetIdx, 0, movedItem);
          this.categories.set(cats);
          this.touchDraggedCatIndex.set(targetIdx);
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate?.(20);
            } catch {}
          }
        }
      }
    }
  }

  onTouchEndCat() {
    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout);
      this.longPressTimeout = null;
    }

    if (this.isTouchDragging) {
      this.isTouchDragging = false;
      this.touchDraggedCatIndex.set(null);
      const orders = this.categories().map((cat, idx) => ({ id: cat.id, sort_order: idx }));
      this.api.reorderCategories(orders).subscribe();
    }
  }

  ngOnDestroy() {
    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout);
      this.longPressTimeout = null;
    }
    if (this.longPressEntTimeout) {
      clearTimeout(this.longPressEntTimeout);
      this.longPressEntTimeout = null;
    }
    if (this.longPressAccTimeout) {
      clearTimeout(this.longPressAccTimeout);
      this.longPressAccTimeout = null;
    }
  }

  // -- Drag & Drop Entities --
  draggedEntIndex = signal<number | null>(null);

  onDragStartEnt(index: number, event: DragEvent) {
    if (this.entities().length <= 1) return;
    this.draggedEntIndex.set(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDragOverEnt(event: DragEvent) {
    event.preventDefault();
  }

  onDropEnt(index: number, event: DragEvent) {
    event.preventDefault();
    const draggedIdx = this.draggedEntIndex();
    if (draggedIdx !== null && draggedIdx !== index) {
      const ents = [...this.entities()];
      const movedItem = ents.splice(draggedIdx, 1)[0];
      ents.splice(index, 0, movedItem);
      
      this.entities.set(ents);
      
      const orders = ents.map((ent, idx) => ({ id: ent.id, sort_order: idx }));
      this.api.reorderEntities(orders).subscribe({
        next: () => this.loadData() // refresh to update accounts list ordering
      });
    }
    this.draggedEntIndex.set(null);
  }
  
  onDragEndEnt() {
    this.draggedEntIndex.set(null);
  }

  // -- Touch Drag & Drop Entities (Mobile Long-Press) --
  touchDraggedEntIndex = signal<number | null>(null);
  private touchStartEntX = 0;
  private touchStartEntY = 0;
  private longPressEntTimeout: any = null;
  private isTouchDraggingEnt = false;

  onTouchStartEnt(index: number, event: TouchEvent) {
    if (this.entities().length <= 1) return;
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    this.touchStartEntX = touch.clientX;
    this.touchStartEntY = touch.clientY;
    this.isTouchDraggingEnt = false;

    if (this.longPressEntTimeout) {
      clearTimeout(this.longPressEntTimeout);
    }

    this.longPressEntTimeout = setTimeout(() => {
      this.isTouchDraggingEnt = true;
      this.touchDraggedEntIndex.set(index);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate?.(40);
        } catch {}
      }
    }, 280);
  }

  onTouchMoveEnt(event: TouchEvent) {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];

    if (!this.isTouchDraggingEnt) {
      const moveDistance = Math.hypot(touch.clientX - this.touchStartEntX, touch.clientY - this.touchStartEntY);
      if (moveDistance > 8) {
        if (this.longPressEntTimeout) {
          clearTimeout(this.longPressEntTimeout);
          this.longPressEntTimeout = null;
        }
      }
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    const currentIdx = this.touchDraggedEntIndex();
    if (currentIdx === null) return;

    if (typeof document !== 'undefined') {
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetDiv = elem?.closest('[data-ent-index]');
      if (targetDiv) {
        const targetIdx = parseInt(targetDiv.getAttribute('data-ent-index') || '', 10);
        if (!isNaN(targetIdx) && targetIdx !== currentIdx && targetIdx >= 0 && targetIdx < this.entities().length) {
          const ents = [...this.entities()];
          const [movedItem] = ents.splice(currentIdx, 1);
          ents.splice(targetIdx, 0, movedItem);
          this.entities.set(ents);
          this.touchDraggedEntIndex.set(targetIdx);
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate?.(20);
            } catch {}
          }
        }
      }
    }
  }

  onTouchEndEnt() {
    if (this.longPressEntTimeout) {
      clearTimeout(this.longPressEntTimeout);
      this.longPressEntTimeout = null;
    }

    if (this.isTouchDraggingEnt) {
      this.isTouchDraggingEnt = false;
      this.touchDraggedEntIndex.set(null);
      const orders = this.entities().map((ent, idx) => ({ id: ent.id, sort_order: idx }));
      this.api.reorderEntities(orders).subscribe({
        next: () => this.loadData()
      });
    }
  }

  // -- Drag & Drop Accounts (per Entity) --
  draggedAccIndex = signal<{entityName: string, index: number} | null>(null);

  onDragStartAcc(entityName: string, index: number, event: DragEvent) {
    const entityAccounts = this.accountsByEntity()[entityName]?.accounts || [];
    if (entityAccounts.length <= 1) return;
    this.draggedAccIndex.set({entityName, index});
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDragOverAcc(entityName: string, event: DragEvent) {
    const dragged = this.draggedAccIndex();
    if (dragged && dragged.entityName === entityName) {
      event.preventDefault(); // Only allow dropping in same entity
    }
  }

  onDropAcc(entityName: string, index: number, event: DragEvent) {
    event.preventDefault();
    const dragged = this.draggedAccIndex();
    if (dragged && dragged.entityName === entityName && dragged.index !== index) {
      const byEnt = {...this.accountsByEntity()};
      const entityAccounts = [...byEnt[entityName].accounts];
      
      const movedItem = entityAccounts.splice(dragged.index, 1)[0];
      entityAccounts.splice(index, 0, movedItem);
      
      byEnt[entityName].accounts = entityAccounts;
      this.accountsByEntity.set(byEnt);
      
      const orders = entityAccounts.map((acc, idx) => ({ id: acc.id, sort_order: idx }));
      this.api.reorderAccounts(orders).subscribe({
         next: () => this.loadData()
      });
    }
    this.draggedAccIndex.set(null);
  }
  
  onDragEndAcc() {
    this.draggedAccIndex.set(null);
  }

  // -- Touch Drag & Drop Accounts (Mobile Long-Press) --
  touchDraggedAcc = signal<{ entityName: string; index: number } | null>(null);
  private touchStartAccX = 0;
  private touchStartAccY = 0;
  private longPressAccTimeout: any = null;
  private isTouchDraggingAcc = false;

  onTouchStartAcc(entityName: string, index: number, event: TouchEvent) {
    const entityAccounts = this.accountsByEntity()[entityName]?.accounts || [];
    if (entityAccounts.length <= 1) return;
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    this.touchStartAccX = touch.clientX;
    this.touchStartAccY = touch.clientY;
    this.isTouchDraggingAcc = false;

    if (this.longPressAccTimeout) {
      clearTimeout(this.longPressAccTimeout);
    }

    this.longPressAccTimeout = setTimeout(() => {
      this.isTouchDraggingAcc = true;
      this.touchDraggedAcc.set({ entityName, index });
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate?.(40);
        } catch {}
      }
    }, 280);
  }

  onTouchMoveAcc(event: TouchEvent) {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];

    if (!this.isTouchDraggingAcc) {
      const moveDistance = Math.hypot(touch.clientX - this.touchStartAccX, touch.clientY - this.touchStartAccY);
      if (moveDistance > 8) {
        if (this.longPressAccTimeout) {
          clearTimeout(this.longPressAccTimeout);
          this.longPressAccTimeout = null;
        }
      }
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    const dragged = this.touchDraggedAcc();
    if (!dragged) return;

    if (typeof document !== 'undefined') {
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetLi = elem?.closest('[data-acc-index]');
      if (targetLi) {
        const targetEntity = targetLi.getAttribute('data-acc-entity');
        const targetIdx = parseInt(targetLi.getAttribute('data-acc-index') || '', 10);
        if (targetEntity === dragged.entityName && !isNaN(targetIdx) && targetIdx !== dragged.index) {
          const byEnt = { ...this.accountsByEntity() };
          const entityData = byEnt[dragged.entityName];
          if (entityData && entityData.accounts) {
            const entityAccounts = [...entityData.accounts];
            if (targetIdx >= 0 && targetIdx < entityAccounts.length) {
              const [movedItem] = entityAccounts.splice(dragged.index, 1);
              entityAccounts.splice(targetIdx, 0, movedItem);
              byEnt[dragged.entityName] = { ...entityData, accounts: entityAccounts };
              this.accountsByEntity.set(byEnt);
              this.touchDraggedAcc.set({ entityName: dragged.entityName, index: targetIdx });
              if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                try {
                  navigator.vibrate?.(20);
                } catch {}
              }
            }
          }
        }
      }
    }
  }

  onTouchEndAcc() {
    if (this.longPressAccTimeout) {
      clearTimeout(this.longPressAccTimeout);
      this.longPressAccTimeout = null;
    }

    if (this.isTouchDraggingAcc) {
      this.isTouchDraggingAcc = false;
      const dragged = this.touchDraggedAcc();
      this.touchDraggedAcc.set(null);
      if (dragged) {
        const byEnt = this.accountsByEntity();
        const entityAccounts = byEnt[dragged.entityName]?.accounts || [];
        const orders = entityAccounts.map((acc: any, idx: number) => ({ id: acc.id, sort_order: idx }));
        this.api.reorderAccounts(orders).subscribe({
          next: () => this.loadData()
        });
      }
    }
  }

  
  // -- Modals & Editing --
  
  private showDialog(id: string, focusInputSelector?: string) {
    if (typeof document === 'undefined') return;
    const dialog = document.getElementById(id) as HTMLDialogElement | null;
    if (!dialog) return;

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    }

    if (this.isMobile()) {
      // En mobile: no hacer foco en ningún elemento para evitar que se abra el teclado virtual
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setTimeout(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }, 0);
    } else {
      // En escritorio: hacer foco en el campo de texto para poder escribir de inmediato
      const doFocus = () => {
        let inputToFocus: HTMLElement | null = null;
        if (focusInputSelector) {
          inputToFocus = dialog.querySelector(focusInputSelector) as HTMLElement | null;
        }
        if (!inputToFocus) {
          inputToFocus = dialog.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea') as HTMLElement | null;
        }
        if (inputToFocus) {
          inputToFocus.focus();
          if (inputToFocus instanceof HTMLInputElement && typeof inputToFocus.setSelectionRange === 'function') {
            const len = inputToFocus.value?.length ?? 0;
            inputToFocus.setSelectionRange(len, len);
          }
        }
      };

      doFocus();
      setTimeout(doFocus, 0);
    }
  }

  openCatModal(cat?: any) {
    this.errorMsg.set('');
    this.showAllColors.set(false);
    if (cat) {
      this.editingCatId.set(cat.id);
      this.catForm.patchValue({ name: cat.name, color: cat.color });
    } else {
      this.editingCatId.set(null);
      this.catForm.reset({ color: this.pastelColors[0] || '' });
    }
    this.showDialog('cat_modal', 'input[formControlName="name"]');
  }

  selectColor(color: string) {
    this.catForm.patchValue({ color });
  }

  openEntModal(ent?: any) {
    this.errorMsg.set('');
    if (ent) {
      this.editingEntId.set(ent.id);
      this.entForm.patchValue({ name: ent.name });
    } else {
      this.editingEntId.set(null);
      this.entForm.reset();
    }
    this.showDialog('ent_modal', 'input[formControlName="name"]');
  }

  openAccModal(acc?: any) {
    this.errorMsg.set('');
    if (acc) {
      this.editingAccId.set(acc.id);
      
      let formattedLimit = '';
      if (acc.available_limit !== null && acc.available_limit !== undefined) {
        formattedLimit = acc.available_limit.toString().replace('.', ',');
      }
      
      this.accForm.patchValue({
        entity_id: acc.entity_id !== undefined && acc.entity_id !== null ? acc.entity_id : '',
        account_type: acc.account_type,
        name: acc.name,
        available_limit: formattedLimit,
        apple_wallet_alias: acc.apple_wallet_alias || ''
      });
    } else {
      this.editingAccId.set(null);
      this.accForm.reset({ entity_id: '', account_type: 'DEBIT' });
    }
    this.showDialog('acc_modal', 'input[formControlName="name"]');
  }
  
  openModal(id: string) {
    this.showDialog(id);
  }
  
  closeModal(id: string) {
    if (typeof document !== 'undefined') {
      const dialog = document.getElementById(id) as HTMLDialogElement | null;
      if (dialog && typeof dialog.close === 'function') {
        dialog.close();
      }
    }
  }
  
  // -- Submits --
  
  onSubmitCat() {
    if (this.catForm.invalid) return;
    this.isSubmitting.set(true);
    
    const obs = this.editingCatId() 
      ? this.api.updateCategory(this.editingCatId()!, this.catForm.value)
      : this.api.createCategory(this.catForm.value);
      
    obs.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeModal('cat_modal');
        this.loadData();
      },
      error: (err) => this.handleError(err)
    });
  }
  
  onSubmitEnt() {
    if (this.entForm.invalid) return;
    this.isSubmitting.set(true);
    
    const obs = this.editingEntId()
      ? this.api.updateEntity(this.editingEntId()!, this.entForm.value)
      : this.api.createEntity(this.entForm.value);
      
    obs.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeModal('ent_modal');
        this.loadData();
      },
      error: (err) => this.handleError(err)
    });
  }
  
  onSubmitAcc() {
    if (this.accForm.invalid) return;
    this.isSubmitting.set(true);
    
    const payload = { ...this.accForm.value };
    payload.entity_id = parseInt(payload.entity_id);
    
    if (payload.account_type === 'CREDIT_CARD') {
      if (payload.available_limit !== null && payload.available_limit !== '') {
        const rawLimit = payload.available_limit.toString();
        payload.available_limit = parseFloat(rawLimit.replace(/\./g, '').replace(',', '.'));
      }
    } else {
      payload.available_limit = null;
    }
    
    const obs = this.editingAccId()
      ? this.api.updateAccount(this.editingAccId()!, payload)
      : this.api.createAccount(payload);
      
    obs.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeModal('acc_modal');
        this.loadData();
      },
      error: (err) => this.handleError(err)
    });
  }
  
  // -- Deletes --

  deleteTarget = signal<{type: 'category'|'entity'|'account', id: number, name: string} | null>(null);

  confirmDeleteCategory(cat: any) {
    this.deleteTarget.set({ type: 'category', id: cat.id, name: cat.name });
    this.openModal('confirm_modal');
  }

  confirmDeleteEntity(ent: any) {
    this.deleteTarget.set({ type: 'entity', id: ent.id, name: ent.name });
    this.openModal('confirm_modal');
  }

  confirmDeleteAccount(acc: any) {
    this.deleteTarget.set({ type: 'account', id: acc.id, name: acc.name });
    this.openModal('confirm_modal');
  }

  executeDelete() {
    const target = this.deleteTarget();
    if (!target) return;
    
    this.isSubmitting.set(true);
    let obs;
    
    if (target.type === 'category') obs = this.api.deleteCategory(target.id);
    else if (target.type === 'entity') obs = this.api.deleteEntity(target.id);
    else if (target.type === 'account') obs = this.api.deleteAccount(target.id);
    
    if (obs) {
      obs.subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.closeModal('confirm_modal');
          this.loadData();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.closeModal('confirm_modal');
          alert(err.error?.detail || 'Error al eliminar');
        }
      });
    }
  }

  private handleError(err: any) {

    console.error(err);
    this.isSubmitting.set(false);
    this.errorMsg.set(err.error?.detail || 'Error en el servidor');
  }
  
  objectKeys(obj: any) {
    return Object.keys(obj);
  }
  
  translateType(type: string) {
    return type === 'CREDIT_CARD' ? 'Tarjeta de Crédito' : 'Débito';
  }

  getTextColorForBackground(hexColor: string): string {
    return getContrastColor(hexColor);
  }

  downloadDatabase() {
    this.isDownloadingDb.set(true);
    this.api.backupDatabase().subscribe({
      next: (response) => {
        this.isDownloadingDb.set(false);
        const blob = response.body;
        if (!blob) return;

        let filename = 'expense_tracker_backup.sqlite';
        const disposition = response.headers.get('content-disposition');
        if (disposition && disposition.includes('filename=')) {
          const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (match && match[1]) {
            filename = match[1].replace(/['"]/g, '');
          }
        } else {
          const dateStr = new Date().toISOString().slice(0, 10);
          filename = `expense_tracker_backup_${dateStr}.sqlite`;
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.isDownloadingDb.set(false);
        console.error('Error al descargar copia de la base de datos', err);
        alert('Error al descargar la copia de seguridad de la base de datos.');
      }
    });
  }

  openImportModal() {
    this.selectedImportFile.set(null);
    this.importError.set('');
    this.importSuccessMsg.set('');
    this.showDialog('import_modal');
  }

  closeImportModal() {
    if (typeof document !== 'undefined') {
      const modal = document.getElementById('import_modal') as HTMLDialogElement | null;
      if (modal && typeof modal.close === 'function') {
        modal.close();
      }
    }
    this.selectedImportFile.set(null);
    this.importError.set('');
    this.importSuccessMsg.set('');
  }

  onImportFileSelected(event: any) {
    const file = event.target?.files?.[0];
    if (file) {
      this.selectedImportFile.set(file);
      this.importError.set('');
    }
  }

  confirmImportDatabase() {
    const file = this.selectedImportFile();
    if (!file) {
      this.importError.set('Por favor, selecciona un archivo SQLite válido.');
      return;
    }

    this.isImportingDb.set(true);
    this.importError.set('');

    this.api.restoreDatabase(file).subscribe({
      next: (res) => {
        this.isImportingDb.set(false);
        this.importSuccessMsg.set('Base de datos importada con éxito. La página se reiniciará en unos segundos...');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      },
      error: (err) => {
        this.isImportingDb.set(false);
        console.error('Error al importar la base de datos:', err);
        const msg = err.error?.detail || 'Error inesperado al procesar la base de datos.';
        this.importError.set(msg);
      }
    });
  }
}
