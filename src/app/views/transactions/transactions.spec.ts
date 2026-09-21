import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Transactions } from './transactions';
import { ApiService } from '../../services/api.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Transactions', () => {
  let component: Transactions;
  let fixture: ComponentFixture<Transactions>;
  let mockApiService: any;

  beforeEach(async () => {
    mockApiService = {
      getTransactions: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 1, pages: 1 })),
      getGeneralReport: vi.fn().mockReturnValue(of(null)),
      getConfig: vi.fn().mockReturnValue(of({ default_account_id: null, timezone: 'America/Argentina/Buenos_Aires' })),
      getAccounts: vi.fn().mockReturnValue(of([])),
      getEntities: vi.fn().mockReturnValue(of([])),
      getCategories: vi.fn().mockReturnValue(of([]))
    };

    await TestBed.configureTestingModule({
      imports: [Transactions],
      providers: [
        { provide: ApiService, useValue: mockApiService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Transactions);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should update showScrollTop based on scroll position', () => {
    expect(component.showScrollTop()).toBe(false);

    // Mock scrollContainer with scrollTop > 200
    (component as any).scrollContainer = { scrollTop: 250, scrollTo: vi.fn(), removeEventListener: vi.fn() } as any;
    component.checkScroll();
    expect(component.showScrollTop()).toBe(true);

    // Mock scrollContainer with scrollTop <= 200
    (component as any).scrollContainer.scrollTop = 50;
    component.checkScroll();
    expect(component.showScrollTop()).toBe(false);
  });

  it('should scroll to top when scrollToTop is invoked', () => {
    const mockContainer = { scrollTop: 300, removeEventListener: vi.fn() } as any;
    (component as any).scrollContainer = mockContainer;
    const windowScrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    component.scrollToTop(0);

    expect(mockContainer.scrollTop).toBe(0);
    expect(windowScrollToSpy).toHaveBeenCalledWith(0, 0);
  });

  it('should step installments correctly', () => {
    component.txForm.patchValue({ installments_count: 1 });
    component.stepInstallments(1);
    expect(component.txForm.get('installments_count')?.value).toBe(2);
    component.stepInstallments(5);
    expect(component.txForm.get('installments_count')?.value).toBe(7);
    component.stepInstallments(-10);
    expect(component.txForm.get('installments_count')?.value).toBe(1);
  });

  it('should render mobile items, trigger openModal on item click, and confirmDeleteTx on delete click without edit trigger', () => {
    const mockTx = {
      id: 101,
      description: 'Supermercado Día',
      total_amount: 15000,
      real_amount: null,
      category_id: 1,
      account_id: 1,
      installments_count: 3,
      transaction_date: '2026-09-20'
    };
    component.transactions.set([mockTx]);
    fixture.detectChanges();

    const openModalSpy = vi.spyOn(component, 'openModal').mockImplementation(() => {});
    const confirmDeleteSpy = vi.spyOn(component, 'confirmDeleteTx').mockImplementation(() => {});

    const mobileListContainer = fixture.nativeElement.querySelector('.md\\:hidden');
    expect(mobileListContainer).toBeTruthy();

    const mobileItem = mobileListContainer.querySelector('.cursor-pointer');
    expect(mobileItem).toBeTruthy();
    expect(mobileItem.textContent).toContain('Supermercado Día');
    // Ensure cuotas are not rendered in mobile item
    expect(mobileItem.textContent).not.toContain('cuotas');

    mobileItem.click();
    expect(openModalSpy).toHaveBeenCalledWith(mockTx);

    // Clicking delete button inside mobile item
    const deleteBtn = mobileItem.querySelector('button');
    expect(deleteBtn).toBeTruthy();
    openModalSpy.mockClear();
    deleteBtn.click();
    expect(confirmDeleteSpy).toHaveBeenCalledWith(mockTx);
    expect(openModalSpy).not.toHaveBeenCalled();
  });

  it('should render type=time on mobile and type=text on desktop with auto-formatting', () => {
    // 1. Mobile mode
    component.isMobile.set(true);
    fixture.detectChanges();
    let timeInput = fixture.nativeElement.querySelector('input[formControlName="transaction_time"]');
    expect(timeInput).toBeTruthy();
    expect(timeInput.getAttribute('type')).toBe('time');

    // 2. Desktop mode
    component.isMobile.set(false);
    fixture.detectChanges();
    timeInput = fixture.nativeElement.querySelector('input[formControlName="transaction_time"]');
    expect(timeInput).toBeTruthy();
    expect(timeInput.getAttribute('type')).toBe('text');
    expect(timeInput.getAttribute('placeholder')).toBe('HH:MM');

    // Test desktop auto-formatting mask
    component.txForm.patchValue({ transaction_time: '14' });
    expect(component.txForm.get('transaction_time')?.value).toBe('14:');
    component.txForm.patchValue({ transaction_time: '14:30' });
    expect(component.txForm.get('transaction_time')?.value).toBe('14:30');
  });

  it('should render full entity-account in dropdown options, and adapt field display for mobile vs desktop', () => {
    component.entities.set([{ id: 1, name: 'Santander' }]);
    component.accounts.set([{ id: 10, name: 'Visa Gold', entity_id: 1 }]);
    component.txForm.patchValue({ account_id: 10 });

    // Options in select dropdown always contain full entity and account name
    fixture.detectChanges();
    const accountSelect = fixture.nativeElement.querySelector('select[formControlName="account_id"]');
    const options = accountSelect.querySelectorAll('option');
    expect(options[1].textContent).toContain('Santander - Visa Gold');

    // Mobile display in closed field: only account name
    component.isMobile.set(true);
    expect(component.getSelectedAccountDisplay()).toBe('Visa Gold');

    // Desktop display in closed field: full entity and account
    component.isMobile.set(false);
    expect(component.getSelectedAccountDisplay()).toBe('Santander - Visa Gold');
  });
});
