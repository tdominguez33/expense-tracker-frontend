import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Settings } from './settings';
import { ApiService } from '../../services/api.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Settings', () => {
  let component: Settings;
  let fixture: ComponentFixture<Settings>;
  let mockApiService: any;

  beforeEach(async () => {
    mockApiService = {
      getConfig: vi.fn().mockReturnValue(of({ default_tax_percentage: 0, default_account_id: null, timezone: 'America/Argentina/Buenos_Aires', statement_grace_days: 10 })),
      getCategories: vi.fn().mockReturnValue(of([])),
      getEntities: vi.fn().mockReturnValue(of([])),
      getAccounts: vi.fn().mockReturnValue(of([])),
      reorderCategories: vi.fn().mockReturnValue(of({ success: true })),
      reorderEntities: vi.fn().mockReturnValue(of({ success: true })),
      reorderAccounts: vi.fn().mockReturnValue(of({ success: true }))
    };

    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        { provide: ApiService, useValue: mockApiService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should step grace days correctly', () => {
    component.configForm.patchValue({ statement_grace_days: 10 });
    component.stepGraceDays(1);
    expect(component.configForm.get('statement_grace_days')?.value).toBe(11);
    component.stepGraceDays(-5);
    expect(component.configForm.get('statement_grace_days')?.value).toBe(6);
    component.stepGraceDays(-10);
    expect(component.configForm.get('statement_grace_days')?.value).toBe(0);
  });

  it('should step tax percentage correctly', () => {
    component.configForm.patchValue({ default_tax_percentage: '0' });
    component.stepTaxConfig(0.1);
    expect(component.configForm.get('default_tax_percentage')?.value).toBe('0,1');
    component.stepTaxConfig(-0.1);
    expect(component.configForm.get('default_tax_percentage')?.value).toBe('0');
  });

  it('should activate touch drag after long-press and reorder categories on release', () => {
    vi.useFakeTimers();
    try {
      component.categories.set([
        { id: 1, name: 'Comida', color: '#ff0000', sort_order: 0 },
        { id: 2, name: 'Transporte', color: '#00ff00', sort_order: 1 },
        { id: 3, name: 'Servicios', color: '#0000ff', sort_order: 2 }
      ]);
      fixture.detectChanges();

      // 1. Touch start on category 0
      component.onTouchStartCat(0, {
        touches: [{ clientX: 100, clientY: 100 }]
      } as any);

      expect(component.touchDraggedCatIndex()).toBeNull();

      // 2. Advance time past long-press duration (280ms)
      vi.advanceTimersByTime(300);
      expect(component.touchDraggedCatIndex()).toBe(0);

      // 3. Move finger over category 1
      const mockLi = document.createElement('li');
      mockLi.setAttribute('data-cat-index', '1');
      (document as any).elementFromPoint = vi.fn().mockReturnValue(mockLi);

      const preventDefaultMock = vi.fn();
      component.onTouchMoveCat({
        touches: [{ clientX: 100, clientY: 150 }],
        cancelable: true,
        preventDefault: preventDefaultMock
      } as any);

      expect(preventDefaultMock).toHaveBeenCalled();
      expect(component.categories()[0].name).toBe('Transporte');
      expect(component.categories()[1].name).toBe('Comida');
      expect(component.touchDraggedCatIndex()).toBe(1);

      // 4. Release touch
      component.onTouchEndCat();
      expect(component.touchDraggedCatIndex()).toBeNull();
      expect(mockApiService.reorderCategories).toHaveBeenCalledWith([
        { id: 2, sort_order: 0 },
        { id: 1, sort_order: 1 },
        { id: 3, sort_order: 2 }
      ]);

      delete (document as any).elementFromPoint;
    } finally {
      vi.useRealTimers();
    }
  });

  it('should cancel touch drag if finger moves significantly before long-press timeout', () => {
    vi.useFakeTimers();
    try {
      component.categories.set([
        { id: 1, name: 'Comida', color: '#ff0000', sort_order: 0 },
        { id: 2, name: 'Transporte', color: '#00ff00', sort_order: 1 }
      ]);
      fixture.detectChanges();

      component.onTouchStartCat(0, {
        touches: [{ clientX: 100, clientY: 100 }]
      } as any);

      // Move 20px down before 280ms expires (scroll gesture)
      component.onTouchMoveCat({
        touches: [{ clientX: 100, clientY: 125 }],
        cancelable: true,
        preventDefault: vi.fn()
      } as any);

      vi.advanceTimersByTime(300);
      expect(component.touchDraggedCatIndex()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should render compact responsive account list with non-wrapping buttons', () => {
    component.entities.set([{ id: 1, name: 'Banco Santander' }]);
    component.accountsByEntity.set({
      'Banco Santander': {
        id: 1,
        accounts: [
          { id: 10, name: 'Visa Signature Black', account_type: 'CREDIT_CARD', entity_id: 1 }
        ]
      }
    });
    fixture.detectChanges();

    const accountLi = fixture.nativeElement.querySelector('ul.menu li');
    expect(accountLi).toBeTruthy();
    expect(accountLi.classList.contains('flex-nowrap')).toBe(true);

    const badge = accountLi.querySelector('.badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('Tarjeta de Crédito');

    const editBtn = accountLi.querySelector('button[title="Editar"]');
    const delBtn = accountLi.querySelector('button[title="Eliminar"]');
    expect(editBtn).toBeTruthy();
    expect(delBtn).toBeTruthy();

    const entityBtnGroup = fixture.nativeElement.querySelector('button[title="Editar Entidad"]')?.parentElement;
    const accountBtnGroup = editBtn?.parentElement;
    expect(entityBtnGroup).toBeTruthy();
    expect(accountBtnGroup).toBeTruthy();
    expect(entityBtnGroup?.className).toBe(accountBtnGroup?.className);
  });

  it('should render drag indicator in entity headers and account items when multiple exist', () => {
    component.entities.set([
      { id: 1, name: 'Banco Galicia' },
      { id: 2, name: 'Banco Santander' }
    ]);
    component.accountsByEntity.set({
      'Banco Galicia': {
        id: 1,
        accounts: [
          { id: 10, name: 'Caja de Ahorro', account_type: 'SAVINGS', entity_id: 1 },
          { id: 11, name: 'Cuenta Corriente', account_type: 'CHECKING', entity_id: 1 }
        ]
      },
      'Banco Santander': { id: 2, accounts: [] }
    });
    fixture.detectChanges();

    const entityHeader = fixture.nativeElement.querySelector('[data-ent-index] h3');
    expect(entityHeader).toBeTruthy();
    const entityDragHandle = entityHeader.querySelector('svg:first-child');
    expect(entityDragHandle).toBeTruthy();
    expect(entityDragHandle.classList.contains('invisible')).toBe(false);

    const accountItem = fixture.nativeElement.querySelector('li[data-acc-index] a');
    expect(accountItem).toBeTruthy();
    const accountDragHandle = accountItem.querySelector('svg:first-child');
    expect(accountDragHandle).toBeTruthy();
    expect(accountDragHandle.classList.contains('invisible')).toBe(false);
  });

  it('should hide drag indicator and disable dragging when only one entity or one account exists', () => {
    component.entities.set([{ id: 1, name: 'Banco Galicia' }]);
    component.accountsByEntity.set({
      'Banco Galicia': {
        id: 1,
        accounts: [
          { id: 10, name: 'Caja de Ahorro', account_type: 'SAVINGS', entity_id: 1 }
        ]
      }
    });
    fixture.detectChanges();

    // Entity handle is invisible (space reserved) and no cursor-grab
    const entityHeader = fixture.nativeElement.querySelector('h3');
    expect(entityHeader).toBeTruthy();
    const entityDragHandle = entityHeader.querySelector('svg:first-child');
    expect(entityDragHandle).toBeTruthy();
    expect(entityDragHandle.classList.contains('invisible')).toBe(true);

    const entityHeaderContainer = entityHeader.parentElement;
    expect(entityHeaderContainer.classList.contains('cursor-grab')).toBe(false);
    expect(entityHeaderContainer.closest('[data-ent-index]')).toBeNull();

    // Account handle is invisible (space reserved) and no cursor-grab
    const accountItem = fixture.nativeElement.querySelector('ul.menu li a');
    expect(accountItem).toBeTruthy();
    const accountDragHandle = accountItem.querySelector('svg:first-child');
    expect(accountDragHandle).toBeTruthy();
    expect(accountDragHandle.classList.contains('invisible')).toBe(true);

    const accountLi = accountItem.parentElement;
    expect(accountLi.classList.contains('cursor-grab')).toBe(false);
    expect(accountLi.getAttribute('data-acc-index')).toBeNull();

    // Touch and drag attempts do nothing
    component.onTouchStartEnt(0, { touches: [{ clientX: 10, clientY: 10 }] } as any);
    expect(component.touchDraggedEntIndex()).toBeNull();

    component.onDragStartEnt(0, {} as any);
    expect(component.draggedEntIndex()).toBeNull();

    component.onTouchStartAcc('Banco Galicia', 0, { touches: [{ clientX: 10, clientY: 10 }] } as any);
    expect(component.touchDraggedAcc()).toBeNull();

    component.onDragStartAcc('Banco Galicia', 0, {} as any);
    expect(component.draggedAccIndex()).toBeNull();
  });

  it('should activate touch drag for entities on long-press and reorder on release', () => {
    vi.useFakeTimers();
    try {
      component.entities.set([
        { id: 1, name: 'Galicia', sort_order: 0 },
        { id: 2, name: 'Santander', sort_order: 1 },
        { id: 3, name: 'BBVA', sort_order: 2 }
      ]);
      fixture.detectChanges();

      // Touch start on entity index 0
      component.onTouchStartEnt(0, {
        touches: [{ clientX: 100, clientY: 100 }]
      } as any);

      expect(component.touchDraggedEntIndex()).toBeNull();

      // Advance 280ms
      vi.advanceTimersByTime(300);
      expect(component.touchDraggedEntIndex()).toBe(0);

      // Move over entity index 1
      const mockDiv = document.createElement('div');
      mockDiv.setAttribute('data-ent-index', '1');
      (document as any).elementFromPoint = vi.fn().mockReturnValue(mockDiv);

      const preventDefaultMock = vi.fn();
      component.onTouchMoveEnt({
        touches: [{ clientX: 100, clientY: 200 }],
        cancelable: true,
        preventDefault: preventDefaultMock
      } as any);

      expect(preventDefaultMock).toHaveBeenCalled();
      expect(component.entities()[0].name).toBe('Santander');
      expect(component.entities()[1].name).toBe('Galicia');
      expect(component.touchDraggedEntIndex()).toBe(1);

      // Release touch
      component.onTouchEndEnt();
      expect(component.touchDraggedEntIndex()).toBeNull();
      expect(mockApiService.reorderEntities).toHaveBeenCalledWith([
        { id: 2, sort_order: 0 },
        { id: 1, sort_order: 1 },
        { id: 3, sort_order: 2 }
      ]);

      delete (document as any).elementFromPoint;
    } finally {
      vi.useRealTimers();
    }
  });

  it('should cancel entity touch drag if finger moves before long-press timeout', () => {
    vi.useFakeTimers();
    try {
      component.entities.set([
        { id: 1, name: 'Galicia', sort_order: 0 },
        { id: 2, name: 'Santander', sort_order: 1 }
      ]);
      fixture.detectChanges();

      component.onTouchStartEnt(0, {
        touches: [{ clientX: 100, clientY: 100 }]
      } as any);

      // Scroll move > 8px
      component.onTouchMoveEnt({
        touches: [{ clientX: 100, clientY: 120 }],
        cancelable: true,
        preventDefault: vi.fn()
      } as any);

      vi.advanceTimersByTime(300);
      expect(component.touchDraggedEntIndex()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should activate touch drag for accounts on long-press and reorder within same entity on release', () => {
    vi.useFakeTimers();
    try {
      component.entities.set([{ id: 1, name: 'Galicia' }]);
      component.accountsByEntity.set({
        'Galicia': {
          id: 1,
          accounts: [
            { id: 10, name: 'Cuenta Sueldo', sort_order: 0 },
            { id: 20, name: 'Visa Gold', sort_order: 1 },
            { id: 30, name: 'Mastercard', sort_order: 2 }
          ]
        }
      });
      fixture.detectChanges();

      // Touch start on account index 0
      component.onTouchStartAcc('Galicia', 0, {
        touches: [{ clientX: 50, clientY: 50 }]
      } as any);

      expect(component.touchDraggedAcc()).toBeNull();

      // Advance 280ms
      vi.advanceTimersByTime(300);
      expect(component.touchDraggedAcc()).toEqual({ entityName: 'Galicia', index: 0 });

      // Move over account index 2 in Galicia
      const mockLi = document.createElement('li');
      mockLi.setAttribute('data-acc-index', '2');
      mockLi.setAttribute('data-acc-entity', 'Galicia');
      (document as any).elementFromPoint = vi.fn().mockReturnValue(mockLi);

      const preventDefaultMock = vi.fn();
      component.onTouchMoveAcc({
        touches: [{ clientX: 50, clientY: 150 }],
        cancelable: true,
        preventDefault: preventDefaultMock
      } as any);

      expect(preventDefaultMock).toHaveBeenCalled();
      const accounts = component.accountsByEntity()['Galicia'].accounts;
      expect(accounts[0].name).toBe('Visa Gold');
      expect(accounts[1].name).toBe('Mastercard');
      expect(accounts[2].name).toBe('Cuenta Sueldo');
      expect(component.touchDraggedAcc()).toEqual({ entityName: 'Galicia', index: 2 });

      // Release touch
      component.onTouchEndAcc();
      expect(component.touchDraggedAcc()).toBeNull();
      expect(mockApiService.reorderAccounts).toHaveBeenCalledWith([
        { id: 20, sort_order: 0 },
        { id: 30, sort_order: 1 },
        { id: 10, sort_order: 2 }
      ]);

      delete (document as any).elementFromPoint;
    } finally {
      vi.useRealTimers();
    }
  });

  it('should not reorder accounts across different entities on touch move', () => {
    vi.useFakeTimers();
    try {
      component.entities.set([{ id: 1, name: 'Galicia' }, { id: 2, name: 'Santander' }]);
      component.accountsByEntity.set({
        'Galicia': {
          id: 1,
          accounts: [
            { id: 10, name: 'Galicia Débito', sort_order: 0 },
            { id: 11, name: 'Galicia Ahorro', sort_order: 1 }
          ]
        },
        'Santander': {
          id: 2,
          accounts: [{ id: 20, name: 'Santander Crédito', sort_order: 0 }]
        }
      });
      fixture.detectChanges();

      component.onTouchStartAcc('Galicia', 0, {
        touches: [{ clientX: 50, clientY: 50 }]
      } as any);

      vi.advanceTimersByTime(300);
      expect(component.touchDraggedAcc()).toEqual({ entityName: 'Galicia', index: 0 });

      // Move over Santander account
      const mockLi = document.createElement('li');
      mockLi.setAttribute('data-acc-index', '0');
      mockLi.setAttribute('data-acc-entity', 'Santander');
      (document as any).elementFromPoint = vi.fn().mockReturnValue(mockLi);

      component.onTouchMoveAcc({
        touches: [{ clientX: 50, clientY: 200 }],
        cancelable: true,
        preventDefault: vi.fn()
      } as any);

      // Nothing changed
      expect(component.accountsByEntity()['Galicia'].accounts.length).toBe(2);
      expect(component.accountsByEntity()['Santander'].accounts.length).toBe(1);
      expect(component.touchDraggedAcc()).toEqual({ entityName: 'Galicia', index: 0 });

      component.onTouchEndAcc();
      delete (document as any).elementFromPoint;
    } finally {
      vi.useRealTimers();
    }
  });

  it('should cancel account touch drag if finger moves before long-press timeout', () => {
    vi.useFakeTimers();
    try {
      component.entities.set([{ id: 1, name: 'Galicia' }]);
      component.accountsByEntity.set({
        'Galicia': {
          id: 1,
          accounts: [{ id: 10, name: 'Galicia Débito', sort_order: 0 }]
        }
      });
      fixture.detectChanges();

      component.onTouchStartAcc('Galicia', 0, {
        touches: [{ clientX: 50, clientY: 50 }]
      } as any);

      component.onTouchMoveAcc({
        touches: [{ clientX: 50, clientY: 80 }],
        cancelable: true,
        preventDefault: vi.fn()
      } as any);

      vi.advanceTimersByTime(300);
      expect(component.touchDraggedAcc()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  describe('Modal focus behavior (Mobile vs Desktop)', () => {
    beforeEach(() => {
      HTMLDialogElement.prototype.showModal = vi.fn();
      HTMLDialogElement.prototype.close = vi.fn();
    });

    it('should blur active element and not focus any element when opening dialogs on mobile', () => {
      component.isMobile.set(true);

      const entInput = fixture.nativeElement.querySelector('#ent_modal input[formControlName="name"]') as HTMLInputElement;
      const accInput = fixture.nativeElement.querySelector('#acc_modal input[formControlName="name"]') as HTMLInputElement;
      const catInput = fixture.nativeElement.querySelector('#cat_modal input[formControlName="name"]') as HTMLInputElement;

      const entFocusSpy = vi.spyOn(entInput, 'focus');
      const accFocusSpy = vi.spyOn(accInput, 'focus');
      const catFocusSpy = vi.spyOn(catInput, 'focus');
      const blurSpy = vi.spyOn(HTMLElement.prototype, 'blur');

      // 1. Entity modal on mobile
      component.openEntModal();
      expect(entFocusSpy).not.toHaveBeenCalled();

      // 2. Account modal on mobile
      component.openAccModal();
      expect(accFocusSpy).not.toHaveBeenCalled();

      // 3. Category modal on mobile
      component.openCatModal();
      expect(catFocusSpy).not.toHaveBeenCalled();

      // blur should be called to ensure no element retains focus
      expect(blurSpy).toHaveBeenCalled();
    });

    it('should focus name input immediately when opening dialogs on desktop to allow typing right away', () => {
      component.isMobile.set(false);

      const entInput = fixture.nativeElement.querySelector('#ent_modal input[formControlName="name"]') as HTMLInputElement;
      const accInput = fixture.nativeElement.querySelector('#acc_modal input[formControlName="name"]') as HTMLInputElement;
      const catInput = fixture.nativeElement.querySelector('#cat_modal input[formControlName="name"]') as HTMLInputElement;

      const entFocusSpy = vi.spyOn(entInput, 'focus');
      const entSelectSpy = vi.spyOn(entInput, 'select');
      const entSelectionRangeSpy = vi.spyOn(entInput, 'setSelectionRange');
      const accFocusSpy = vi.spyOn(accInput, 'focus');
      const catFocusSpy = vi.spyOn(catInput, 'focus');

      // 1. Entity modal on desktop (should focus, position caret at end, but NOT select all text in blue)
      component.openEntModal({ id: 1, name: 'Banco Galicia' });
      expect(entFocusSpy).toHaveBeenCalled();
      expect(entSelectSpy).not.toHaveBeenCalled();
      expect(entSelectionRangeSpy).toHaveBeenCalledWith('Banco Galicia'.length, 'Banco Galicia'.length);

      // 2. Account modal on desktop (focuses name input so user can type immediately, without selecting)
      component.openAccModal();
      expect(accFocusSpy).toHaveBeenCalled();

      // 3. Category modal on desktop
      component.openCatModal();
      expect(catFocusSpy).toHaveBeenCalled();
    });

    it('should update isMobile on checkIsMobile and onResize', () => {
      vi.stubGlobal('innerWidth', 375);
      component.checkIsMobile();
      expect(component.isMobile()).toBe(true);

      vi.stubGlobal('innerWidth', 1024);
      component.onResize();
      expect(component.isMobile()).toBe(false);

      vi.unstubAllGlobals();
    });

    it('should default entity_id to empty string ("Selecciona una entidad") when creating a new account', () => {
      component.openAccModal();
      expect(component.accForm.get('entity_id')?.value).toBe('');
      expect(component.editingAccId()).toBeNull();
    });

    it('should default entity_id to empty string ("Selecciona una entidad") when editing an account without entity_id', () => {
      component.openAccModal({ id: 5, name: 'Efectivo', account_type: 'DEBIT', entity_id: null });
      expect(component.accForm.get('entity_id')?.value).toBe('');
      expect(component.editingAccId()).toBe(5);
    });

    it('should retain existing entity_id when editing an account that already has an entity', () => {
      component.openAccModal({ id: 10, name: 'Visa Gold', account_type: 'CREDIT_CARD', entity_id: 2 });
      expect(component.accForm.get('entity_id')?.value).toBe(2);
      expect(component.editingAccId()).toBe(10);
    });

    it('should reload data silently without setting isLoading when silent is true', async () => {
      component.isLoading.set(false);
      mockApiService.getCategories.mockReturnValue(of([{ id: 1, name: 'Comida', color: '#ff0000' }]));

      await component.loadData({ silent: true });

      expect(component.isLoading()).toBe(false);
      expect(component.categories().length).toBe(1);
      expect(component.categories()[0].name).toBe('Comida');
    });
  });
});
