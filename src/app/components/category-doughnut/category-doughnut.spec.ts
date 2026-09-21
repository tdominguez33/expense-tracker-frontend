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
});
