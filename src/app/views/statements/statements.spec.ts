import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
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
