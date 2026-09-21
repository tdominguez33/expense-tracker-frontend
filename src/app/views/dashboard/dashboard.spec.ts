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
});
