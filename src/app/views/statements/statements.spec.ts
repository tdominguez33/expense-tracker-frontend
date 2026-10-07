import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
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
});
