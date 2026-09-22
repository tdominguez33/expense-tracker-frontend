import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Dashboard } from './dashboard';
import { ApiService } from '../../services/api.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;
  let mockApiService: any;

  beforeEach(async () => {
    mockApiService = {
      getEntities: vi.fn().mockReturnValue(of([])),
      getCategories: vi.fn().mockReturnValue(of([])),
      getAccounts: vi.fn().mockReturnValue(of([])),
      getGeneralReport: vi.fn().mockReturnValue(of({ totals: {}, comparisons: {} })),
      getCreditAllReport: vi.fn().mockReturnValue(of({ total_global_debt: 0, total_available_limit: 0 })),
      getCreditReport: vi.fn().mockReturnValue(of({}))
    };

    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        { provide: ApiService, useValue: mockApiService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should select, toggle and clear timeline bars and compute peak and active count', () => {
    const mockBar = { label: '15', fullLabel: 'Día 15', amount: 5000, heightPct: 100 };
    expect(component.selectedTimelineBar()).toBeNull();

    // 1. Select bar
    component.selectTimelineBar(mockBar);
    expect(component.selectedTimelineBar()).toEqual(mockBar);
    expect(component.activeTimelineBar()).toEqual(mockBar);

    // 2. Toggle same bar off
    component.selectTimelineBar(mockBar);
    expect(component.selectedTimelineBar()).toBeNull();

    // 3. Peak and active count calculation
    component.generalReport.set({
      totals: { week: 15000 },
      timeline: {
        week: [1000, 5000, 0, 3000, 0, 6000, 0]
      }
    });
    component.setPeriod('week');

    const peak = component.getTimelinePeak();
    expect(peak).toBeTruthy();
    expect(peak?.label).toBe('Sábado');
    expect(peak?.amount).toBe(6000);

    const count = component.getTimelineActiveCount();
    expect(count.active).toBe(4);
    expect(count.total).toBe(7);

    // 4. Test month rows splitting for mobile
    const monthTimeline: Record<number, number> = {};
    for (let d = 1; d <= 30; d++) {
      monthTimeline[d] = d * 100;
    }
    component.generalReport.set({
      totals: { month: 46500 },
      timeline: { month: monthTimeline }
    });
    component.setPeriod('month');

    const monthRows = component.getTimelineMonthRows();
    expect(monthRows.length).toBe(2);
    expect(monthRows[0].length).toBe(15);
    expect(monthRows[0][0].label).toBe('1');
    expect(monthRows[0][14].label).toBe('15');
    expect(monthRows[1][0].label).toBe('16');

    // 5. Outside click and touch deselects
    component.selectedTimelineBar.set(mockBar);
    expect(component.selectedTimelineBar()).toEqual(mockBar);

    // Click outside
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(component.selectedTimelineBar()).toBeNull();

    // Touch tap outside
    component.selectedTimelineBar.set(mockBar);
    component.onTouchStart({ touches: [{ clientX: 100, clientY: 100 }] } as any);
    component.onTouchEnd({ changedTouches: [{ clientX: 101, clientY: 101 }], target: document.body } as any);
    expect(component.selectedTimelineBar()).toBeNull();
  });

  it('should manage periods, period bounds, and mobile navigation', () => {
    // Default is 'month' (index 2)
    expect(component.selectedPeriod()).toBe('month');
    expect(component.currentPeriodIndex()).toBe(2);

    // Next period -> 'year' (index 3)
    component.goToNextPeriod();
    expect(component.selectedPeriod()).toBe('year');
    expect(component.currentPeriodIndex()).toBe(3);

    // Cannot go beyond last period
    component.goToNextPeriod();
    expect(component.selectedPeriod()).toBe('year');
    expect(component.currentPeriodIndex()).toBe(3);

    // Prev period -> 'month' -> 'week' -> 'day'
    component.goToPrevPeriod();
    expect(component.selectedPeriod()).toBe('month');
    expect(component.currentPeriodIndex()).toBe(2);

    component.goToPrevPeriod();
    expect(component.selectedPeriod()).toBe('week');
    expect(component.currentPeriodIndex()).toBe(1);

    component.goToPrevPeriod();
    expect(component.selectedPeriod()).toBe('day');
    expect(component.currentPeriodIndex()).toBe(0);

    // Cannot go before first period
    component.goToPrevPeriod();
    expect(component.selectedPeriod()).toBe('day');
    expect(component.currentPeriodIndex()).toBe(0);

    // Mouse gesture drag left -> goToNextPeriod
    component.onCardsMouseDown({ clientX: 200 } as MouseEvent);
    component.onCardsMouseMove({ clientX: 100 } as MouseEvent);
    component.onCardsMouseUp({ clientX: 100 } as MouseEvent);
    expect(component.selectedPeriod()).toBe('week');

    // Mouse gesture drag right -> goToPrevPeriod
    component.onCardsMouseDown({ clientX: 100 } as MouseEvent);
    component.onCardsMouseMove({ clientX: 200 } as MouseEvent);
    component.onCardsMouseUp({ clientX: 200 } as MouseEvent);
    expect(component.selectedPeriod()).toBe('day');
  });

  it('should navigate chart carousel via touch swipe and buttons', () => {
    component.setPeriod('month');
    expect(component.activeSlide()).toBe(0);
    expect(component.getChartTransform()).toBe('translateX(0%)');

    // Button navigation
    component.nextSlide();
    expect(component.activeSlide()).toBe(1);
    expect(component.getChartTransform()).toBe('translateX(-100%)');

    component.prevSlide();
    expect(component.activeSlide()).toBe(0);
    expect(component.getChartTransform()).toBe('translateX(0%)');

    // Direct slide navigation
    component.goToSlide(1);
    expect(component.activeSlide()).toBe(1);

    // Touch swipe left on chart (from slide 0 to 1)
    component.goToSlide(0);
    component.onChartTouchStart({ touches: [{ clientX: 200, clientY: 100 }] } as any);
    component.onChartTouchMove({ touches: [{ clientX: 120, clientY: 100 }] } as any);
    expect(component.isChartSwiping).toBe(true);
    component.onChartTouchEnd({} as any);
    expect(component.activeSlide()).toBe(1);

    // Touch swipe right on chart (from slide 1 to 0)
    component.onChartTouchStart({ touches: [{ clientX: 100, clientY: 100 }] } as any);
    component.onChartTouchMove({ touches: [{ clientX: 180, clientY: 100 }] } as any);
    expect(component.isChartSwiping).toBe(true);
    component.onChartTouchEnd({} as any);
    expect(component.activeSlide()).toBe(0);

    // Vertical scroll gesture (deltaY > deltaX) should NOT trigger chart swipe or slide change
    component.onChartTouchStart({ touches: [{ clientX: 100, clientY: 100 }] } as any);
    component.onChartTouchMove({ touches: [{ clientX: 125, clientY: 170 }] } as any);
    expect(component.isChartSwiping).toBe(false);
    expect(component.chartSwipeOffset()).toBe(0);
    component.onChartTouchEnd({} as any);
    expect(component.activeSlide()).toBe(0);

    // Day period forces activeSlide to 0 and blocks navigation
    component.setPeriod('day');
    expect(component.activeSlide()).toBe(0);
    component.nextSlide();
    expect(component.activeSlide()).toBe(0);
  });

  it('should navigate cards via touch swipe limited to one card and integrated buttons', () => {
    component.setPeriod('day');
    expect(component.currentPeriodIndex()).toBe(0);
    expect(component.getCardsTransform()).toBe('translateX(0%)');

    // Integrated Next Click
    const stopPropagationMock = vi.fn();
    component.onCardNextClick({ stopPropagation: stopPropagationMock } as any);
    expect(stopPropagationMock).toHaveBeenCalled();
    expect(component.selectedPeriod()).toBe('week');
    expect(component.currentPeriodIndex()).toBe(1);
    expect(component.getCardsTransform()).toBe('translateX(-100%)');

    // Rapid click during lock is ignored (prevents step skipping)
    expect(component.isNavigatingPeriod).toBe(true);
    component.onCardNextClick({ stopPropagation: stopPropagationMock } as any);
    expect(component.selectedPeriod()).toBe('week');

    // Reset lock to test prev click
    component.isNavigatingPeriod = false;

    // Integrated Prev Click
    component.onCardPrevClick({ stopPropagation: stopPropagationMock } as any);
    expect(component.selectedPeriod()).toBe('day');
    expect(component.currentPeriodIndex()).toBe(0);
    expect(component.getCardsTransform()).toBe('translateX(0%)');

    // Touch swipe left on cards -> moves exactly 1 card forward
    component.onCardsTouchStart({ touches: [{ clientX: 200, clientY: 100 }] } as any);
    component.onCardsTouchMove({ touches: [{ clientX: 100, clientY: 100 }] } as any);
    expect(component.isCardsSwiping).toBe(true);
    component.onCardsTouchEnd({} as any);
    expect(component.selectedPeriod()).toBe('week');
    expect(component.currentPeriodIndex()).toBe(1);

    // Large swipe left -> still moves ONLY 1 card forward (from week to month, never skipping to year)
    component.onCardsTouchStart({ touches: [{ clientX: 400, clientY: 100 }] } as any);
    component.onCardsTouchMove({ touches: [{ clientX: 50, clientY: 100 }] } as any); // large delta -350px
    component.onCardsTouchEnd({} as any);
    expect(component.selectedPeriod()).toBe('month');
    expect(component.currentPeriodIndex()).toBe(2);

    // Touch swipe right on cards -> moves exactly 1 card back (from month to week)
    component.onCardsTouchStart({ touches: [{ clientX: 50, clientY: 100 }] } as any);
    component.onCardsTouchMove({ touches: [{ clientX: 300, clientY: 100 }] } as any);
    component.onCardsTouchEnd({} as any);
    expect(component.selectedPeriod()).toBe('week');
    expect(component.currentPeriodIndex()).toBe(1);

    // Vertical scroll gesture on cards should NOT trigger cards swipe or period change
    component.onCardsTouchStart({ touches: [{ clientX: 100, clientY: 100 }] } as any);
    component.onCardsTouchMove({ touches: [{ clientX: 130, clientY: 180 }] } as any);
    expect(component.isCardsSwiping).toBe(false);
    expect(component.cardsSwipeOffset()).toBe(0);
    component.onCardsTouchEnd({} as any);
    expect(component.selectedPeriod()).toBe('week');
    expect(component.currentPeriodIndex()).toBe(1);
  });

  it('should compute constant desktop doughnut card min-height accommodating all categories across periods', () => {
    // Default base height with few/no categories is at least 360px
    expect(component.getDesktopDoughnutMinHeight()).toBe('360px');

    // With report having 16 categories in 'year'
    const yearCats: Record<number, number> = {};
    for (let i = 1; i <= 16; i++) {
      yearCats[i] = 1000 * i;
    }
    component.generalReport.set({
      totals: { day: 1000, year: 105000 },
      by_category: {
        day: { 1: 1000 }, // only 1 category on day
        year: yearCats    // 16 categories on year
      }
    });

    // Sized for the maximum (16 categories = 8 rows -> 36 + 8*40 + 42 = 398px)
    const minH = component.getDesktopDoughnutMinHeight();
    expect(minH).toBe('398px');

    // Verify it stays constant regardless of whether 'day' or 'year' is currently selected
    component.setPeriod('day');
    expect(component.getDesktopDoughnutMinHeight()).toBe('398px');

    component.setPeriod('year');
    expect(component.getDesktopDoughnutMinHeight()).toBe('398px');
  });

  it('should compute maxCategoryAmount as the maximum across all periods', () => {
    component.generalReport.set({
      totals: { day: 500, week: 12000, month: 85000, year: 1200000 },
      by_category: {
        day: { 1: 500 },
        week: { 1: 4000, 2: 8000 },
        month: { 1: 15000, 2: 70000 },
        year: { 1: 200000, 2: 1000000 }
      }
    });

    expect(component.maxCategoryAmount()).toBe(1000000);
  });
});
