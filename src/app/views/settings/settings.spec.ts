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
      reorderCategories: vi.fn().mockReturnValue(of({ success: true }))
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
});
