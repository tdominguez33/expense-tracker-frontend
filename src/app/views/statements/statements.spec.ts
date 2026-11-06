import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Observable, of } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { Statements } from './statements';

describe('Statements - Expenses Sorting', () => {
  let component: Statements;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Statements],
      providers: [provideHttpClient(), provideRouter([])]
    });
    const fixture = TestBed.createComponent(Statements);
    component = fixture.componentInstance;
  });

  it('should default expensesSort to oldest', () => {
    expect(component.expensesSort()).toBe('oldest');
  });

  it('should toggle between oldest and amount when toggleExpensesSort is called', () => {
    expect(component.expensesSort()).toBe('oldest');
    component.toggleExpensesSort();
    expect(component.expensesSort()).toBe('amount');
    component.toggleExpensesSort();
    expect(component.expensesSort()).toBe('oldest');
  });

  it('should sort items from oldest to newest by transaction_date when expensesSort is oldest', () => {
    component.viewingDetailsData.set({
      subtotal: 1000,
      tax_amount: 0,
      total_amount: 1000,
      items: [
        { id: 1, description: 'B', transaction_date: '2026-03-15', installment_amount: 500 },
        { id: 2, description: 'A', transaction_date: '2026-01-10', installment_amount: 100 },
        { id: 3, description: 'C', transaction_date: '2026-02-20', installment_amount: 900 }
      ]
    });
    component.expensesSort.set('oldest');

    const details = component.getViewingDetails();
    expect(details.map(d => d.description)).toEqual(['A', 'C', 'B']);
  });

  it('should sort items by installment_amount descending when expensesSort is amount', () => {
    component.viewingDetailsData.set({
      subtotal: 1000,
      tax_amount: 0,
      total_amount: 1000,
      items: [
        { id: 1, description: 'B', transaction_date: '2026-03-15', installment_amount: 500 },
        { id: 2, description: 'A', transaction_date: '2026-01-10', installment_amount: 100 },
        { id: 3, description: 'C', transaction_date: '2026-02-20', installment_amount: 900 }
      ]
    });
    component.expensesSort.set('amount');

    const details = component.getViewingDetails();
    expect(details.map(d => d.description)).toEqual(['C', 'B', 'A']);
  });
});

describe('Statements - Comments', () => {
  let component: Statements;
  let mockApi: any;

  beforeEach(() => {
    mockApi = {
      updateStatement: vi.fn().mockReturnValue(of({ ok: true })),
      getStatements: vi.fn().mockImplementation(() => of(component.statements())),
      getStatementItems: vi.fn().mockReturnValue(of({ items: [], subtotal: 0, tax_amount: 0, total_amount: 0 })),
      getConfig: vi.fn().mockReturnValue(of({})),
      getEntities: vi.fn().mockReturnValue(of([])),
      getCategories: vi.fn().mockReturnValue(of([])),
      getAccounts: vi.fn().mockReturnValue(of([]))
    };

    TestBed.configureTestingModule({
      imports: [Statements],
      providers: [
        { provide: ApiService, useValue: mockApi },
        provideRouter([])
      ]
    });
    const fixture = TestBed.createComponent(Statements);
    component = fixture.componentInstance;
  });

  it('hasComment should correctly identify statements with non-empty comments', () => {
    expect(component.hasComment(null)).toBe(false);
    expect(component.hasComment({})).toBe(false);
    expect(component.hasComment({ comment: null })).toBe(false);
    expect(component.hasComment({ comment: '' })).toBe(false);
    expect(component.hasComment({ comment: '   ' })).toBe(false);
    expect(component.hasComment({ comment: 'Pagar con dólares' })).toBe(true);
  });

  it('openCommentModal should set commentTarget and initialize commentControl', () => {
    const st = { id: 10, comment: 'Comentario existente' };
    component.openCommentModal(st);
    expect(component.commentTarget()).toBe(st);
    expect(component.commentControl.value).toBe('Comentario existente');
  });

  it('saveComment should call updateStatement with trimmed text and update local state', () => {
    const st = { id: 10, comment: '' };
    component.statements.set([{ id: 10, comment: '' }, { id: 11, comment: 'otro' }]);
    component.commentTarget.set(st);
    component.commentControl.setValue('  Nuevo comentario  ');

    component.saveComment();

    expect(mockApi.updateStatement).toHaveBeenCalledWith(10, { comment: 'Nuevo comentario' });
    const updated = component.statements().find(s => s.id === 10);
    expect(updated?.comment).toBe('Nuevo comentario');
  });

  it('deleteComment should call updateStatement with null and update local state', () => {
    const st = { id: 10, comment: 'Comentario anterior' };
    component.statements.set([{ id: 10, comment: 'Comentario anterior' }]);
    component.commentTarget.set(st);

    component.deleteComment();

    expect(mockApi.updateStatement).toHaveBeenCalledWith(10, { comment: null });
    const updated = component.statements().find(s => s.id === 10);
    expect(updated?.comment).toBeNull();
  });

  it('loadData should update data without setting isLoading when silent is true', async () => {
    component.isLoading.set(false);
    mockApi.getStatements.mockReturnValue(of([{ id: 101 }]));

    await component.loadData({ silent: true });

    expect(component.isLoading()).toBe(false);
    expect(component.statements().length).toBe(1);
    expect(component.statements()[0].id).toBe(101);
  });

  it('should show and hide visual comment tooltip with enter/exit animations on hover and click', async () => {
    mockApi.getAccounts.mockReturnValue(of([{ id: 1, name: 'Visa Signature', entity_id: null, account_type: 'CREDIT_CARD' }]));
    const stList = [
      {
        id: 1,
        account_id: 1,
        closing_date: '2026-03-20',
        due_date: '2026-03-30',
        start_date: '2026-02-21',
        total_amount: 150000,
        is_paid: false,
        comment: 'Pagar con fondos de caja de ahorro'
      }
    ];
    mockApi.getStatements.mockReturnValue(of(stList));

    const fixture = TestBed.createComponent(Statements);
    const comp = fixture.componentInstance;
    await comp.loadData();
    fixture.detectChanges();

    // Find the comment icon span
    const iconSpans = fixture.nativeElement.querySelectorAll('span.cursor-pointer');
    expect(iconSpans.length).toBeGreaterThan(0);
    const commentIcon = iconSpans[0] as HTMLElement;

    // Hover to show tooltip
    commentIcon.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    expect(comp.activeTooltip()).not.toBeNull();
    expect(comp.activeTooltip()?.text).toBe('Pagar con fondos de caja de ahorro');
    expect(comp.isTooltipClosing()).toBe(false);
    expect(comp.isTouchTooltip()).toBe(false);

    let tooltipEl = fixture.nativeElement.querySelector('.fixed.z-\\[9999\\]');
    expect(tooltipEl).not.toBeNull();
    expect(tooltipEl.textContent).toContain('Pagar con fondos de caja de ahorro');
    expect(tooltipEl.classList.contains('comment-tooltip-in')).toBe(true);

    // Mouse leave to start exit animation
    commentIcon.dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();

    expect(comp.isTooltipClosing()).toBe(true);
    expect(tooltipEl.classList.contains('comment-tooltip-out')).toBe(true);

    // After animation timeout completes
    await new Promise(r => setTimeout(r, 140));
    fixture.detectChanges();

    expect(comp.activeTooltip()).toBeNull();
    tooltipEl = fixture.nativeElement.querySelector('.fixed.z-\\[9999\\]');
    expect(tooltipEl).toBeNull();

    // Toggle on click (touch mode)
    commentIcon.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
    expect(comp.activeTooltip()).not.toBeNull();
    expect(comp.isTooltipClosing()).toBe(false);
    expect(comp.isTouchTooltip()).toBe(true);

    // Backdrop should exist in touch mode
    let backdrop = fixture.nativeElement.querySelector('.fixed.z-\\[9998\\]');
    expect(backdrop).not.toBeNull();

    // Tapping backdrop dismisses tooltip without triggering underlying element
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(comp.isTooltipClosing()).toBe(true);

    await new Promise(r => setTimeout(r, 140));
    fixture.detectChanges();
    expect(comp.activeTooltip()).toBeNull();
    expect(fixture.nativeElement.querySelector('.fixed.z-\\[9998\\]')).toBeNull();
  });
});

describe('Statements - Move Expenses (Postpone)', () => {
  let component: Statements;
  let mockApi: any;
  let fixture: any;

  beforeEach(() => {
    mockApi = {
      postponeTransaction: vi.fn().mockReturnValue(of({ success: true })),
      getStatementItems: vi.fn().mockReturnValue(of({ items: [], subtotal: 0, tax_amount: 0, total_amount: 0 })),
      getStatements: vi.fn().mockReturnValue(of([])),
      getConfig: vi.fn().mockReturnValue(of({})),
      getEntities: vi.fn().mockReturnValue(of([])),
      getCategories: vi.fn().mockReturnValue(of([])),
      getAccounts: vi.fn().mockReturnValue(of([]))
    };

    TestBed.configureTestingModule({
      imports: [Statements],
      providers: [
        { provide: ApiService, useValue: mockApi },
        provideRouter([])
      ]
    });
    fixture = TestBed.createComponent(Statements);
    component = fixture.componentInstance;
  });

  it('should show loading spinner on postpone action, keep button size fixed, and maintain it for at least 300ms', async () => {
    const inst = { id: 42, description: 'Notebook', installment_number: 1, postponed_months: 0 };
    component.postponeTargetInst.set(inst);
    component.postponeTargetIsForward.set(true);
    fixture.detectChanges();

    const initialBtn = fixture.nativeElement.querySelector('#confirm_postpone_modal button.btn-primary');
    expect(initialBtn).not.toBeNull();
    expect(initialBtn.classList.contains('min-w-[10rem]')).toBe(true);
    expect(initialBtn.classList.contains('flex-nowrap')).toBe(true);

    const executePromise = component.executePostpone();
    fixture.detectChanges();

    // Spinner and submitting state are active immediately
    expect(component.isSubmittingPostpone()).toBe(true);
    const confirmBtn = fixture.nativeElement.querySelector('#confirm_postpone_modal button.btn-primary');
    expect(confirmBtn).not.toBeNull();
    expect(confirmBtn.disabled).toBe(true);
    expect(confirmBtn.querySelector('.loading-spinner')).not.toBeNull();
    expect(confirmBtn.classList.contains('min-w-[10rem]')).toBe(true);

    // After 150ms, it must still be in loading state (< 300ms min duration)
    await new Promise(r => setTimeout(r, 150));
    fixture.detectChanges();
    expect(component.isSubmittingPostpone()).toBe(true);
    expect(confirmBtn.querySelector('.loading-spinner')).not.toBeNull();

    // After 300ms total, it finishes
    await executePromise;
    fixture.detectChanges();

    expect(component.isSubmittingPostpone()).toBe(false);
    expect(confirmBtn.querySelector('.loading-spinner')).toBeNull();
    expect(mockApi.postponeTransaction).toHaveBeenCalledWith(42, true);
  });
});

describe('Statements - Detail Loading State', () => {
  let component: Statements;
  let mockApi: any;
  let fixture: any;

  beforeEach(() => {
    mockApi = {
      getStatements: vi.fn().mockReturnValue(of([
        {
          id: 10,
          account_id: 1,
          start_date: '2026-02-21',
          closing_date: '2026-03-20',
          due_date: '2026-03-30',
          total_amount: 150000,
          is_paid: false
        }
      ])),
      getStatementItems: vi.fn(),
      getConfig: vi.fn().mockReturnValue(of({})),
      getEntities: vi.fn().mockReturnValue(of([])),
      getCategories: vi.fn().mockReturnValue(of([])),
      getAccounts: vi.fn().mockReturnValue(of([{ id: 1, name: 'Visa', account_type: 'CREDIT_CARD' }]))
    };

    TestBed.configureTestingModule({
      imports: [Statements],
      providers: [
        { provide: ApiService, useValue: mockApi },
        provideRouter([])
      ]
    });
    fixture = TestBed.createComponent(Statements);
    component = fixture.componentInstance;
  });

  it('should keep loading until all statement detail data is ready and avoid showing empty/zero data', async () => {
    let itemsObserver: any;
    mockApi.getStatementItems.mockReturnValue(new Observable(obs => {
      itemsObserver = obs;
    }));

    await component.loadData();
    fixture.detectChanges();

    component.routeId.set(10);
    component.loadStatementItems(10);
    fixture.detectChanges();

    // While loading items:
    expect(component.isDetailsReady()).toBe(false);
    expect(component.isLoadingDetails()).toBe(true);

    // Shows loading spinner and skeleton, does NOT show stats cards with $0
    const spinner = fixture.nativeElement.querySelector('.loading.loading-spinner.loading-lg');
    expect(spinner).not.toBeNull();
    const skeleton = fixture.nativeElement.querySelector('.skeleton');
    expect(skeleton).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Gasto Total');

    // When items arrive:
    itemsObserver.next({
      statement: { id: 10 },
      items: [{ id: 1, description: 'Supermarket', installment_amount: 50000, transaction_date: '2026-03-01' }],
      subtotal: 50000,
      tax_amount: 0,
      total_amount: 50000
    });
    itemsObserver.complete();
    fixture.detectChanges();

    expect(component.isDetailsReady()).toBe(true);
    expect(component.isLoadingDetails()).toBe(false);

    // Spinner is gone, stats card and items are visible
    expect(fixture.nativeElement.querySelector('.loading.loading-spinner.loading-lg')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Gasto Total');
    expect(fixture.nativeElement.textContent).toContain('Supermarket');
  });
});
