import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { HistoryView, SPINNER_DELAY_MS } from './history';
import { DEFAULT_PAGE_SIZE } from '../transactions/transactions';
import { ApiService } from '../../services/api.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('HistoryView', () => {
  let component: HistoryView;
  let fixture: ComponentFixture<HistoryView>;
  let mockApiService: any;

  const mockReport = {
    year: 2026,
    month: 8,
    period_label: 'Agosto 2026',
    total_amount: 1733457,
    transaction_count: 55,
    average_per_day: 55917.97,
    average_per_month: null,
    comparison: {
      current: 1733457,
      previous: 690807,
      diff: 1042650,
      percentage: 150.9,
      period_type: 'month'
    },
    by_category: [
      { id: 10, name: 'Ropa', color: '#EDBB99', amount: 916112, pct: 53, count: 8 },
      { id: 1, name: 'Super', color: '#10B981', amount: 300000, pct: 17, count: 12 }
    ],
    timeline: [
      { label: '1', day: 1, amount: 50000, count: 2 },
      { label: '2', day: 2, amount: 0, count: 0 }
    ],
    transactions: [
      { id: 101, transaction_date: '2026-08-15', description: 'Zapatillas', amount: 916112, category_id: 10, category_name: 'Ropa', category_color: '#EDBB99', account_name: 'Visa', installments_count: 3 },
      { id: 102, transaction_date: '2026-08-10', description: 'Coto', amount: 300000, category_id: 1, category_name: 'Super', category_color: '#10B981', account_name: 'Débito', installments_count: 1 }
    ],
    available_years: [2025, 2026],
    available_months: [7, 8, 9]
  };

  beforeEach(async () => {
    mockApiService = {
      getHistoryReport: vi.fn().mockReturnValue(of(mockReport))
    };

    await TestBed.configureTestingModule({
      imports: [HistoryView],
      providers: [
        { provide: ApiService, useValue: mockApiService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HistoryView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to previous month on init', () => {
    const now = new Date();
    let expectedMonth = now.getMonth();
    let expectedYear = now.getFullYear();
    if (expectedMonth === 0) {
      expectedMonth = 12;
      expectedYear -= 1;
    }
    expect(component.selectedYear()).toBe(expectedYear);
    expect(component.selectedMonth()).toBe(expectedMonth);
  });

  it('should load report data and populate available years/months', () => {
    expect(mockApiService.getHistoryReport).toHaveBeenCalled();
    expect(component.reportData()).toEqual(mockReport);
    expect(component.availableYears()).toEqual([2025, 2026]);
    expect(component.availableMonths()).toEqual([7, 8, 9]);
    expect(component.getPeriodLabel()).toBe('Agosto 2026');
  });

  it('should step between months correctly', () => {
    component.selectedYear.set(2026);
    component.selectedMonth.set(8);

    component.prevPeriod();
    expect(component.selectedMonth()).toBe(7);
    expect(component.selectedYear()).toBe(2026);

    component.nextPeriod();
    expect(component.selectedMonth()).toBe(8);
  });

  it('should handle whole year mode and step only to available years', () => {
    component.setMonth(null);
    expect(component.selectedMonth()).toBeNull();
    expect(mockApiService.getHistoryReport).toHaveBeenCalledWith(component.selectedYear(), null);

    // 2026 is the maximum available year in mockReport [2025, 2026], cannot go next
    expect(component.canGoNext()).toBe(false);
    expect(component.canGoPrev()).toBe(true);

    // Stepping to previous available year (2025)
    component.prevPeriod();
    expect(component.selectedYear()).toBe(2025);
    expect(component.selectedMonth()).toBeNull();
  });

  it('should not allow selecting months with no expenses and disable their buttons', () => {
    // mockReport.available_months has [7, 8, 9] (Jul, Ago, Sep)
    // Month 1 (Ene) has no data
    expect(component.isMonthAvailable(1)).toBe(false);
    expect(component.isMonthAvailable(8)).toBe(true);

    // Attempting to select month 1 should be ignored
    component.setMonth(1);
    expect(component.selectedMonth()).not.toBe(1);

    // In DOM, check month buttons
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('.card button');
    // Button for 'Ene' should have cursor-default, opacity text-base-content/40, aria-disabled, and not have dot indicator
    const eneButton = Array.from(buttons).find((b: any) => b.textContent.trim().startsWith('Ene')) as HTMLButtonElement;
    expect(eneButton).toBeTruthy();
    expect(eneButton.getAttribute('aria-disabled')).toBe('true');
    expect(eneButton.classList.contains('cursor-default')).toBe(true);
    expect(eneButton.classList.contains('cursor-not-allowed')).toBe(false);
    expect(eneButton.classList.contains('text-base-content/40')).toBe(true);
    expect(eneButton.classList.contains('hover:bg-transparent')).toBe(true);

    // Clicking Ene button in DOM should NOT change selectedMonth
    const currentMonth = component.selectedMonth();
    eneButton.click();
    expect(component.selectedMonth()).toBe(currentMonth);

    // Dot indicator should not exist
    const dot = eneButton.querySelector('span.rounded-full');
    expect(dot).toBeNull();

    // Button for 'Ago' should be active/selectable
    const agoButton = Array.from(buttons).find((b: any) => b.textContent.trim().startsWith('Ago')) as HTMLButtonElement;
    expect(agoButton).toBeTruthy();
    expect(agoButton.getAttribute('aria-disabled')).toBe('false');
    expect(agoButton.classList.contains('cursor-default')).toBe(false);
  });

  it('should filter transactions by category and search query', () => {
    expect(component.filteredTransactions().length).toBe(2);

    component.toggleCategoryFilter(10);
    expect(component.filteredTransactions().length).toBe(1);
    expect(component.filteredTransactions()[0].description).toBe('Zapatillas');

    component.clearCategoryFilter();
    expect(component.filteredTransactions().length).toBe(2);

    component.searchQuery.set('Coto');
    expect(component.filteredTransactions().length).toBe(1);
    expect(component.filteredTransactions()[0].description).toBe('Coto');
  });

  it('should filter transactions by date filter', () => {
    expect(component.filteredTransactions().length).toBe(2);

    component.dateFilter.set('2026-08-15');
    expect(component.filteredTransactions().length).toBe(1);
    expect(component.filteredTransactions()[0].description).toBe('Zapatillas');

    component.dateFilter.set('2026-08-10');
    expect(component.filteredTransactions().length).toBe(1);
    expect(component.filteredTransactions()[0].description).toBe('Coto');

    component.dateFilter.set('2026-08-01');
    expect(component.filteredTransactions().length).toBe(0);

    component.clearDateFilter();
    expect(component.filteredTransactions().length).toBe(2);
  });

  it('should toggle date filter when clicking timeline bars', () => {
    const timeline = component.getTimelineData();
    expect(timeline.length).toBe(2);
    const barWithData = timeline[0]; // Day 1, amount 50000, dateKey: 2026-08-01
    const barZero = timeline[1];     // Day 2, amount 0

    // Clicking zero amount bar does nothing
    component.onBarClick(barZero, 1);
    expect(component.dateFilter()).toBe('');

    // Clicking bar with data sets dateFilter and hoveredBarIndex
    component.onBarClick(barWithData, 0);
    expect(component.dateFilter()).toBe(barWithData.dateKey);
    expect(component.isBarSelected(barWithData)).toBe(true);
    expect(component.hoveredBarIndex()).toBe(0);

    // Clicking same bar again toggles it off
    component.onBarClick(barWithData, 0);
    expect(component.dateFilter()).toBe('');
    expect(component.isBarSelected(barWithData)).toBe(false);
  });

  it('should clear date selection when clicking inside timeline card only (and outside controls)', () => {
    component.dateFilter.set('2026-08-01');

    const timelineCard = document.createElement('div');
    timelineCard.id = 'timeline-card';
    document.body.appendChild(timelineCard);

    const outsideDiv = document.createElement('div');
    document.body.appendChild(outsideDiv);

    // Clicking anywhere OUTSIDE timeline-card should NOT clear dateFilter
    component.onDocumentClick({ target: outsideDiv } as any);
    expect(component.dateFilter()).toBe('2026-08-01');

    // Clicking a button inside timeline-card should NOT clear dateFilter
    const btn = document.createElement('button');
    timelineCard.appendChild(btn);
    component.onDocumentClick({ target: btn } as any);
    expect(component.dateFilter()).toBe('2026-08-01');

    // Clicking an input inside timeline-card should NOT clear dateFilter
    const input = document.createElement('input');
    timelineCard.appendChild(input);
    component.onDocumentClick({ target: input } as any);
    expect(component.dateFilter()).toBe('2026-08-01');

    // Clicking a timeline bar inside timeline-card should NOT clear dateFilter
    const barEl = document.createElement('div');
    barEl.setAttribute('data-timeline-bar', 'true');
    timelineCard.appendChild(barEl);
    component.onDocumentClick({ target: barEl } as any);
    expect(component.dateFilter()).toBe('2026-08-01');

    // Clicking neutral space INSIDE timeline-card SHOULD clear dateFilter
    const insideDiv = document.createElement('div');
    timelineCard.appendChild(insideDiv);
    component.onDocumentClick({ target: insideDiv } as any);
    expect(component.dateFilter()).toBe('');

    // Cleanup
    timelineCard.remove();
    outsideDiv.remove();
  });

  it('should render clear button inside date input and clear filter when clicked', () => {
    component.dateFilter.set('2026-08-01');
    fixture.detectChanges();

    const clearBtn = fixture.nativeElement.querySelector('button[title="Limpiar fecha"]');
    expect(clearBtn).toBeTruthy();
    expect(clearBtn.textContent.trim()).toBe('✕');

    clearBtn.click();
    fixture.detectChanges();

    expect(component.dateFilter()).toBe('');
    const clearBtnAfter = fixture.nativeElement.querySelector('button[title="Limpiar fecha"]');
    expect(clearBtnAfter).toBeNull();
  });

  it('should reset date filter on period changes', () => {
    component.dateFilter.set('2026-08-15');
    expect(component.dateFilter()).toBe('2026-08-15');

    // setMonth
    component.setMonth(7);
    expect(component.dateFilter()).toBe('');

    component.dateFilter.set('2026-07-10');
    // prevPeriod
    component.prevPeriod();
    expect(component.dateFilter()).toBe('');

    component.dateFilter.set('2026-07-10');
    // setYear
    component.setYear(2026);
    expect(component.dateFilter()).toBe('');
  });

  it('should format date filter label and calculate min/max dates properly', () => {
    // Label formatting
    component.dateFilter.set('2026-08-15');
    expect(component.getFormattedDateFilterLabel()).toBe('15-08-2026');

    component.dateFilter.set('2026-08');
    expect(component.getFormattedDateFilterLabel()).toBe('Agosto 2026');

    // Month mode min/max
    component.selectedYear.set(2026);
    component.selectedMonth.set(8);
    expect(component.getMinDate()).toBe('2026-08-01');
    expect(component.getMaxDate()).toBe('2026-08-31');

    // Year mode min/max
    component.selectedMonth.set(null);
    expect(component.getMinDate()).toBe('2026-01');
    expect(component.getMaxDate()).toBe('2026-12');
  });

  it('should clear all filters at once', () => {
    component.categoryFilter.set(10);
    component.searchQuery.set('test');
    component.dateFilter.set('2026-08-15');

    component.clearAllFilters();
    expect(component.categoryFilter()).toBeNull();
    expect(component.searchQuery()).toBe('');
    expect(component.dateFilter()).toBe('');
    expect(component.currentPage()).toBe(1);
  });

  it('should not show spinner if request completes faster than SPINNER_DELAY_MS', () => {
    vi.useFakeTimers();
    const subject = new Subject<any>();
    mockApiService.getHistoryReport.mockReturnValue(subject.asObservable());

    component.loadReport();
    expect(component.isLoading()).toBe(true);
    expect(component.showSpinner()).toBe(false);

    // Fast response after 100ms (< 250ms)
    vi.advanceTimersByTime(100);
    expect(component.showSpinner()).toBe(false);

    subject.next(mockReport);
    subject.complete();

    expect(component.isLoading()).toBe(false);
    expect(component.showSpinner()).toBe(false);

    // Advance past 250ms to ensure it never turns true after completion
    vi.advanceTimersByTime(200);
    expect(component.showSpinner()).toBe(false);

    vi.useRealTimers();
  });

  it('should show spinner if request takes longer than SPINNER_DELAY_MS', () => {
    vi.useFakeTimers();
    const subject = new Subject<any>();
    mockApiService.getHistoryReport.mockReturnValue(subject.asObservable());

    component.loadReport();
    expect(component.isLoading()).toBe(true);
    expect(component.showSpinner()).toBe(false);

    // Advance 250ms
    vi.advanceTimersByTime(SPINNER_DELAY_MS);
    expect(component.showSpinner()).toBe(true);

    // Now complete response
    subject.next(mockReport);
    subject.complete();

    expect(component.isLoading()).toBe(false);
    expect(component.showSpinner()).toBe(false);

    vi.useRealTimers();
  });

  it('should track hovered timeline bar and compute hovered details', () => {
    expect(component.hoveredBarIndex()).toBeNull();
    expect(component.getHoveredBar()).toBeNull();

    component.hoveredBarIndex.set(0);
    const hovered = component.getHoveredBar();
    expect(hovered).toBeTruthy();
    expect(hovered.amount).toBe(50000);
    expect(hovered.fullLabel).toContain('1 de');

    // Bar at index 1 has amount 0
    component.hoveredBarIndex.set(1);
    expect(component.getHoveredBar()).toBeNull();

    component.hoveredBarIndex.set(null);
    expect(component.getHoveredBar()).toBeNull();
  });

  it('should paginate transactions according to DEFAULT_PAGE_SIZE', () => {
    expect(component.pageSize()).toBe(DEFAULT_PAGE_SIZE);
    expect(component.currentPage()).toBe(1);

    // Create 110 mock transactions
    const manyTxs = Array.from({ length: 110 }, (_, i) => ({
      id: i + 1,
      transaction_date: '2026-08-01',
      description: `Tx ${i + 1}`,
      amount: 1000,
      category_id: 1,
      category_name: 'Super',
      category_color: '#10B981',
      account_name: 'Visa',
      installments_count: 1
    }));

    component.reportData.set({
      ...component.reportData(),
      transactions: manyTxs
    });

    expect(component.totalItems()).toBe(110);
    expect(component.totalPages()).toBe(Math.ceil(110 / DEFAULT_PAGE_SIZE)); // 3 pages (50, 50, 10)
    expect(component.paginatedTransactions().length).toBe(DEFAULT_PAGE_SIZE);
    expect(component.paginatedTransactions()[0].description).toBe('Tx 1');

    // Page 2
    component.goToPage(2);
    expect(component.currentPage()).toBe(2);
    expect(component.paginatedTransactions().length).toBe(DEFAULT_PAGE_SIZE);
    expect(component.paginatedTransactions()[0].description).toBe(`Tx ${DEFAULT_PAGE_SIZE + 1}`);

    // Page 3
    component.goToPage(3);
    expect(component.currentPage()).toBe(3);
    expect(component.paginatedTransactions().length).toBe(10);

    // Invalid page boundary checks
    component.goToPage(4);
    expect(component.currentPage()).toBe(3);
    component.goToPage(0);
    expect(component.currentPage()).toBe(3);

    // Filtering resets page to 1
    component.toggleCategoryFilter(10);
    expect(component.currentPage()).toBe(1);
  });

  it('should return appropriate text contrast color for category badge background', () => {
    // Light color: #EDBB99 should return dark text #1f2937
    expect(component.getTextColorForBackground('#EDBB99')).toBe('#1f2937');
    // Dark color: #10B981 or #000000 should return light text #ffffff
    expect(component.getTextColorForBackground('#1E3A8A')).toBe('#ffffff');
    expect(component.getTextColorForBackground('#000000')).toBe('#ffffff');
    // White background should return dark text
    expect(component.getTextColorForBackground('#FFFFFF')).toBe('#1f2937');
  });

  it('should format transaction date as DD-MM-YYYY in transactions table', () => {
    fixture.detectChanges();
    const dateCell = fixture.nativeElement.querySelector('table tbody tr td');
    expect(dateCell).toBeTruthy();
    // mockReport has transaction_date: '2026-08-15', so rendered text should be '15-08-2026'
    expect(dateCell.textContent.trim()).toBe('15-08-2026');
  });

  it('should sort transactions with tri-state behavior (asc, desc, clear on 3rd click)', () => {
    // Initial sort: null (natural backend order)
    expect(component.sortColumn()).toBeNull();
    expect(component.sortDirection()).toBeNull();
    expect(component.filteredTransactions()[0].description).toBe('Zapatillas'); // 2026-08-15
    expect(component.filteredTransactions()[1].description).toBe('Coto'); // 2026-08-10

    // 1st click: date desc
    component.setSort('date');
    expect(component.sortColumn()).toBe('date');
    expect(component.sortDirection()).toBe('desc');
    expect(component.filteredTransactions()[0].description).toBe('Zapatillas');
    expect(component.filteredTransactions()[1].description).toBe('Coto');

    // 2nd click: date asc
    component.setSort('date');
    expect(component.sortColumn()).toBe('date');
    expect(component.sortDirection()).toBe('asc');
    expect(component.filteredTransactions()[0].description).toBe('Coto');
    expect(component.filteredTransactions()[1].description).toBe('Zapatillas');

    // 3rd click: date cleared (null)
    component.setSort('date');
    expect(component.sortColumn()).toBeNull();
    expect(component.sortDirection()).toBeNull();

    // Sort by description: 1st click asc
    component.setSort('description');
    expect(component.sortColumn()).toBe('description');
    expect(component.sortDirection()).toBe('asc');
    expect(component.filteredTransactions()[0].description).toBe('Coto');
    expect(component.filteredTransactions()[1].description).toBe('Zapatillas');

    // 2nd click: description desc
    component.setSort('description');
    expect(component.sortColumn()).toBe('description');
    expect(component.sortDirection()).toBe('desc');
    expect(component.filteredTransactions()[0].description).toBe('Zapatillas');
    expect(component.filteredTransactions()[1].description).toBe('Coto');

    // 3rd click: description cleared (null)
    component.setSort('description');
    expect(component.sortColumn()).toBeNull();
    expect(component.sortDirection()).toBeNull();

    // Sort by amount: 1st click desc (highest first)
    component.setSort('amount');
    expect(component.sortColumn()).toBe('amount');
    expect(component.sortDirection()).toBe('desc');
    expect(component.filteredTransactions()[0].amount).toBe(916112);
    expect(component.filteredTransactions()[1].amount).toBe(300000);

    // 2nd click: amount asc (lowest first)
    component.setSort('amount');
    expect(component.sortColumn()).toBe('amount');
    expect(component.sortDirection()).toBe('asc');
    expect(component.filteredTransactions()[0].amount).toBe(300000);
    expect(component.filteredTransactions()[1].amount).toBe(916112);

    // 3rd click: amount cleared (null)
    component.setSort('amount');
    expect(component.sortColumn()).toBeNull();
    expect(component.sortDirection()).toBeNull();

    // DOM header clicks test
    fixture.detectChanges();
    const thHeaders = fixture.nativeElement.querySelectorAll('table thead th');
    expect(thHeaders.length).toBe(6);
    const amountTh = thHeaders[5];

    // Click 1: amount desc
    amountTh.click();
    expect(component.sortColumn()).toBe('amount');
    expect(component.sortDirection()).toBe('desc');

    // Click 2: amount asc
    amountTh.click();
    expect(component.sortColumn()).toBe('amount');
    expect(component.sortDirection()).toBe('asc');

    // Click 3: clear
    amountTh.click();
    expect(component.sortColumn()).toBeNull();
    expect(component.sortDirection()).toBeNull();
  });
});
