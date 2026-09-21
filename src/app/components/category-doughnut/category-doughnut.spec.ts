import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryDoughnut } from './category-doughnut';
import { describe, it, expect, beforeEach } from 'vitest';

describe('CategoryDoughnut', () => {
  let component: CategoryDoughnut;
  let fixture: ComponentFixture<CategoryDoughnut>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryDoughnut]
    }).compileComponents();

    fixture = TestBed.createComponent(CategoryDoughnut);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should compute SVG breakdown and hovered info', () => {
    fixture.componentRef.setInput('breakdown', [
      { id: 1, name: 'Comida', color: '#ff0000', amount: 500, pct: 50 },
      { id: 2, name: 'Servicios', color: '#00ff00', amount: 500, pct: 50 }
    ]);
    fixture.componentRef.setInput('totalAmount', 1000);
    fixture.componentRef.setInput('periodTitle', 'Este Mes');
    fixture.detectChanges();

    const svg = component.getSvgBreakdown();
    expect(svg.length).toBe(2);
    expect(svg[0].offset).toBe(100);
    expect(svg[1].offset).toBe(50);

    const defaultInfo = component.getHoveredInfo();
    expect(defaultInfo.name).toBe('Total Este Mes');
    expect(defaultInfo.amount).toBe(1000);

    component.hoveredCategory.set(1);
    const hoveredInfo = component.getHoveredInfo();
    expect(hoveredInfo.name).toBe('Comida');
    expect(hoveredInfo.amount).toBe(500);
  });

  it('should select category on click/tap, switch on other category click, and deselect on outside click', () => {
    fixture.componentRef.setInput('breakdown', [
      { id: 1, name: 'Comida', color: '#ff0000', amount: 500, pct: 50 },
      { id: 2, name: 'Servicios', color: '#00ff00', amount: 500, pct: 50 }
    ]);
    fixture.componentRef.setInput('totalAmount', 1000);
    fixture.componentRef.setInput('periodTitle', 'Este Mes');
    fixture.detectChanges();

    // 1. Select category 1
    const legendItems = fixture.nativeElement.querySelectorAll('li[data-category-id]');
    expect(legendItems.length).toBe(2);

    legendItems[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(component.selectedCategory()).toBe(1);
    expect(component.activeCategoryId()).toBe(1);
    expect(component.getHoveredInfo().name).toBe('Comida');

    // 2. Switch to category 2
    legendItems[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(component.selectedCategory()).toBe(2);
    expect(component.activeCategoryId()).toBe(2);
    expect(component.getHoveredInfo().name).toBe('Servicios');

    // 3. Click outside (document)
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(component.selectedCategory()).toBe(null);
    expect(component.activeCategoryId()).toBe(null);
    expect(component.getHoveredInfo().name).toBe('Total Este Mes');
  });

  it('should handle mobile touch taps to select category and tap outside to clear', () => {
    fixture.componentRef.setInput('breakdown', [
      { id: 1, name: 'Comida', color: '#ff0000', amount: 500, pct: 50 },
      { id: 2, name: 'Servicios', color: '#00ff00', amount: 500, pct: 50 }
    ]);
    fixture.componentRef.setInput('totalAmount', 1000);
    fixture.detectChanges();

    const legendItems = fixture.nativeElement.querySelectorAll('li[data-category-id]');

    // Simulate touch tap (< 10px delta)
    component.onTouchStart({
      touches: [{ clientX: 100, clientY: 100 }]
    } as any);

    component.onTouchEnd({
      changedTouches: [{ clientX: 102, clientY: 101 }],
      target: legendItems[0]
    } as any);

    expect(component.selectedCategory()).toBe(1);

    // Simulate tap outside
    component.onTouchStart({
      touches: [{ clientX: 200, clientY: 200 }]
    } as any);

    component.onTouchEnd({
      changedTouches: [{ clientX: 200, clientY: 200 }],
      target: document.body
    } as any);

    expect(component.selectedCategory()).toBe(null);
  });
});
