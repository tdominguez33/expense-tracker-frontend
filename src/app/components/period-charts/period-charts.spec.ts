import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PeriodCharts, TimelineBarItem } from './period-charts';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('PeriodCharts', () => {
  let component: PeriodCharts;
  let fixture: ComponentFixture<PeriodCharts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PeriodCharts]
    }).compileComponents();

    fixture = TestBed.createComponent(PeriodCharts);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate carousel via next, prev and direct slide methods', () => {
    expect(component.activeSlide()).toBe(0);
    expect(component.getChartTransform()).toBe('translateX(0%)');

    const slideChangeSpy = vi.fn();
    component.slideChange.subscribe(slideChangeSpy);

    component.nextSlide();
    expect(component.activeSlide()).toBe(1);
    expect(component.getChartTransform()).toBe('translateX(-100%)');
    expect(slideChangeSpy).toHaveBeenCalledWith(1);

    component.nextSlide();
    expect(component.activeSlide()).toBe(0);

    component.prevSlide();
    expect(component.activeSlide()).toBe(1);

    component.goToSlide(0);
    expect(component.activeSlide()).toBe(0);
  });

  it('should handle touch swipe gestures and vertical scroll locking', () => {
    // Touch swipe left from slide 0 -> slide 1
    component.goToSlide(0);
    component.onChartTouchStart({ touches: [{ clientX: 250, clientY: 100 }] } as any);
    component.onChartTouchMove({ touches: [{ clientX: 150, clientY: 100 }] } as any);
    expect(component.isSwiping).toBe(true);
    component.onChartTouchEnd({} as any);
    expect(component.activeSlide()).toBe(1);

    // Touch swipe right from slide 1 -> slide 0
    component.onChartTouchStart({ touches: [{ clientX: 100, clientY: 100 }] } as any);
    component.onChartTouchMove({ touches: [{ clientX: 200, clientY: 100 }] } as any);
    expect(component.isSwiping).toBe(true);
    component.onChartTouchEnd({} as any);
    expect(component.activeSlide()).toBe(0);

    // Vertical gesture (deltaY > deltaX * 0.75) locks to vertical and does NOT swipe
    component.onChartTouchStart({ touches: [{ clientX: 100, clientY: 100 }] } as any);
    component.onChartTouchMove({ touches: [{ clientX: 120, clientY: 180 }] } as any);
    expect(component.isSwiping).toBe(false);
    expect(component.swipeOffset()).toBe(0);
    component.onChartTouchEnd({} as any);
    expect(component.activeSlide()).toBe(0);
  });

  it('should handle mouse drag gestures', () => {
    component.goToSlide(0);
    // Mouse drag left -> switches to slide 1
    component.onChartMouseDown({ button: 0, clientX: 200 } as MouseEvent);
    component.onChartMouseMove({ clientX: 100 } as MouseEvent);
    expect(component.isSwiping).toBe(true);
    component.onChartMouseUp({} as MouseEvent);
    expect(component.activeSlide()).toBe(1);

    // Mouse drag right -> switches to slide 0
    component.onChartMouseDown({ button: 0, clientX: 100 } as MouseEvent);
    component.onChartMouseMove({ clientX: 200 } as MouseEvent);
    expect(component.isSwiping).toBe(true);
    component.onChartMouseUp({} as MouseEvent);
    expect(component.activeSlide()).toBe(0);
  });

  it('should calculate peak, active count, and responsive month rows', () => {
    const mockData: TimelineBarItem[] = [];
    for (let i = 1; i <= 30; i++) {
      mockData.push({
        label: i.toString(),
        fullLabel: `Día ${i}`,
        amount: i === 15 ? 50000 : (i % 2 === 0 ? 1000 : 0),
        count: i === 15 ? 3 : (i % 2 === 0 ? 1 : 0)
      });
    }

    fixture.componentRef.setInput('timelineData', mockData);
    fixture.componentRef.setInput('isMonthView', true);

    const processed = component.processedTimelineData();
    expect(processed.length).toBe(30);

    // Peak test
    const peak = component.timelinePeak();
    expect(peak).toBeTruthy();
    expect(peak?.label).toBe('Día 15');
    expect(peak?.amount).toBe(50000);

    // Active count test: 15 even days + day 15 (odd) = 16 active days
    const activeCount = component.timelineActiveCount();
    expect(activeCount.active).toBe(16);
    expect(activeCount.total).toBe(30);

    // Month rows test
    const rows = component.timelineMonthRows();
    expect(rows.length).toBe(2);
    expect(rows[0].length).toBe(15);
    expect(rows[0][0].label).toBe('1');
    expect(rows[0][14].label).toBe('15');
    expect(rows[1].length).toBe(15);
    expect(rows[1][0].label).toBe('16');
  });

  it('should handle bar click, selection, hover, and outside click deselect', () => {
    const bar: TimelineBarItem = {
      label: '5',
      fullLabel: '5 de Agosto',
      amount: 12000,
      count: 2,
      dateKey: '2026-08-05'
    };

    const barClickSpy = vi.fn();
    component.barClick.subscribe(barClickSpy);

    // Click bar
    component.onBarClick(bar);
    expect(barClickSpy).toHaveBeenCalledWith(bar);
    expect(component.isBarActive(bar)).toBe(true);
    expect(component.activeBar()?.fullLabel).toBe(bar.fullLabel);

    // Click same bar to toggle off
    component.onBarClick(bar);
    expect(component.selectedBar()).toBeNull();

    // Hover bar
    component.hoverBar(bar);
    expect(component.hoveredBar()).toEqual(bar);
    expect(component.activeBar()?.fullLabel).toBe(bar.fullLabel);
    component.leaveBar();
    expect(component.hoveredBar()).toBeNull();

    // Document click outside timeline bar clears selection
    component.onBarClick(bar);
    expect(component.selectedBar()).toEqual(bar);
    component.onDocumentClick({ target: document.body } as any);
    expect(component.selectedBar()).toBeNull();

    // Document touch tap outside clears selection
    component.onBarClick(bar);
    expect(component.selectedBar()).toEqual(bar);
    component.onDocTouchStart({ touches: [{ clientX: 50, clientY: 50 }] } as any);
    component.onDocTouchEnd({ changedTouches: [{ clientX: 51, clientY: 51 }], target: document.body } as any);
    expect(component.selectedBar()).toBeNull();
  });
});
