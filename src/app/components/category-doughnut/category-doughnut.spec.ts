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

    // 3. Click category 2 again to deselect it
    legendItems[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(component.selectedCategory()).toBe(null);
    expect(component.activeCategoryId()).toBe(null);
    expect(component.getHoveredInfo().name).toBe('Total Este Mes');

    // 4. Click outside (document)
    legendItems[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(component.selectedCategory()).toBe(1);

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(component.selectedCategory()).toBe(null);
    expect(component.activeCategoryId()).toBe(null);
    expect(component.getHoveredInfo().name).toBe('Total Este Mes');
  });

  it('should handle mobile touch taps to select category, deselect on re-tap, and tap outside to clear', () => {
    fixture.componentRef.setInput('breakdown', [
      { id: 1, name: 'Comida', color: '#ff0000', amount: 500, pct: 50 },
      { id: 2, name: 'Servicios', color: '#00ff00', amount: 500, pct: 50 }
    ]);
    fixture.componentRef.setInput('totalAmount', 1000);
    fixture.detectChanges();

    const legendItems = fixture.nativeElement.querySelectorAll('li[data-category-id]');

    // 1. Simulate touch tap to select category 1
    component.onTouchStart({
      touches: [{ clientX: 100, clientY: 100 }]
    } as any);

    component.onTouchEnd({
      changedTouches: [{ clientX: 102, clientY: 101 }],
      target: legendItems[0]
    } as any);

    expect(component.selectedCategory()).toBe(1);

    // 2. Simulate touch tap on category 1 again to deselect
    component.onTouchStart({
      touches: [{ clientX: 100, clientY: 100 }]
    } as any);

    component.onTouchEnd({
      changedTouches: [{ clientX: 101, clientY: 101 }],
      target: legendItems[0]
    } as any);

    expect(component.selectedCategory()).toBe(null);

    // 3. Select category 1 again and tap outside
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

  it('should compute effectiveMaxAmount and amountMinWidthCh for visual alignment', () => {
    // 1. Without maxAmount input, defaults to max in current breakdown
    fixture.componentRef.setInput('breakdown', [
      { id: 1, name: 'Comida', color: '#ff0000', amount: 500, pct: 25 },
      { id: 2, name: 'Alquiler', color: '#00ff00', amount: 150000, pct: 75 }
    ]);
    fixture.detectChanges();

    expect(component.effectiveMaxAmount()).toBe(150000);
    // '$150.000' is 8 characters -> 8 + 0.5 = 8.5ch
    expect(component.amountMinWidthCh()).toBe(8.5);

    // 2. With global maxAmount input across all periods (e.g. year has 25400000 -> '$25.400.000' = 11 chars)
    fixture.componentRef.setInput('maxAmount', 25400000);
    fixture.detectChanges();

    expect(component.effectiveMaxAmount()).toBe(25400000);
    expect(component.amountMinWidthCh()).toBe(11.5);

    // Verify amount spans have the computed min-width
    const amountSpan = fixture.nativeElement.querySelector('li[data-category-id="1"] span.tabular-nums.text-right') as HTMLElement;
    expect(amountSpan).toBeTruthy();
    expect(amountSpan.style.minWidth).toBe('11.5ch');
  });

  it('should support collapsing and expanding categories beyond top 5 on mobile without scroll', () => {
    const eightCategories = [
      { id: 1, name: 'Cat 1', color: '#f00', amount: 800, pct: 30 },
      { id: 2, name: 'Cat 2', color: '#0f0', amount: 500, pct: 20 },
      { id: 3, name: 'Cat 3', color: '#00f', amount: 400, pct: 15 },
      { id: 4, name: 'Cat 4', color: '#ff0', amount: 300, pct: 10 },
      { id: 5, name: 'Cat 5', color: '#0ff', amount: 200, pct: 10 },
      { id: 6, name: 'Cat 6', color: '#f0f', amount: 100, pct: 5 },
      { id: 7, name: 'Cat 7', color: '#888', amount: 100, pct: 5 },
      { id: 8, name: 'Cat 8', color: '#aaa', amount: 100, pct: 5 }
    ];
    fixture.componentRef.setInput('breakdown', eightCategories);
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('li[data-category-id]');
    expect(items.length).toBe(8);

    // Initial state: not expanded
    expect(component.isExpanded()).toBe(false);
    const expandGrid = fixture.nativeElement.querySelector('.expand-grid');
    expect(expandGrid).toBeTruthy();
    expect(expandGrid.classList.contains('expanded')).toBe(false);

    // Toggle button should be present
    const toggleBtn = fixture.nativeElement.querySelector('button.btn-ghost');
    expect(toggleBtn).toBeTruthy();
    expect(toggleBtn.textContent).toContain('Ver más (3 más)');

    // Click toggle to expand
    toggleBtn.click();
    fixture.detectChanges();

    expect(component.isExpanded()).toBe(true);
    expect(expandGrid.classList.contains('expanded')).toBe(true);
    expect(toggleBtn.textContent).toContain('Ver menos');

    // Click toggle to collapse
    toggleBtn.click();
    fixture.detectChanges();

    expect(component.isExpanded()).toBe(false);
    expect(expandGrid.classList.contains('expanded')).toBe(false);

    // Auto-expand when selecting category #7 (index 6) via click
    component.onCategoryClick(7);
    fixture.detectChanges();
    expect(component.isExpanded()).toBe(true);
    expect(expandGrid.classList.contains('expanded')).toBe(true);

    // Collapse again: category #7 (extra) should be deselected because it becomes hidden
    component.toggleExpand();
    fixture.detectChanges();
    expect(component.isExpanded()).toBe(false);
    expect(component.selectedCategory()).toBe(null);

    // Select a top category (#2, index 1) that remains visible when collapsed
    component.onCategoryClick(2);
    fixture.detectChanges();
    expect(component.selectedCategory()).toBe(2);

    // Expand list
    component.toggleExpand();
    fixture.detectChanges();
    expect(component.isExpanded()).toBe(true);
    expect(component.selectedCategory()).toBe(2);

    // Collapse list again: top category should REMAIN selected
    component.toggleExpand();
    fixture.detectChanges();
    expect(component.isExpanded()).toBe(false);
    expect(component.selectedCategory()).toBe(2);

    // Deselect category 2
    component.clearSelection();

    // Auto-expand when touching category #8 (index 7) via touch tap
    component.onTouchStart({ touches: [{ clientX: 100, clientY: 100 }] } as any);
    component.onTouchEnd({
      changedTouches: [{ clientX: 101, clientY: 101 }],
      target: items[7]
    } as any);
    fixture.detectChanges();
    expect(component.isExpanded()).toBe(true);
    expect(expandGrid.classList.contains('expanded')).toBe(true);

    // Expansion should persist when breakdown is passed a new array instance with same categories
    fixture.componentRef.setInput('breakdown', [...eightCategories]);
    fixture.detectChanges();
    expect(component.isExpanded()).toBe(true);

    // Expansion should reset to collapsed when periodTitle changes
    fixture.componentRef.setInput('periodTitle', 'Esta Semana');
    fixture.detectChanges();
    expect(component.isExpanded()).toBe(false);
    expect(expandGrid.classList.contains('expanded')).toBe(false);
  });

  it('should support hovering and selecting all categories when there are 10 categories (5 top, 5 extra)', () => {
    const tenCategories = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `Cat ${i + 1}`,
      color: `#${i}${i}0000`,
      amount: (10 - i) * 100,
      pct: 10
    }));

    fixture.componentRef.setInput('breakdown', tenCategories);
    fixture.componentRef.setInput('totalAmount', 5500);
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('li[data-category-id]');
    expect(items.length).toBe(10);

    // Verify template applies pointer-events class for desktop support
    for (const item of items) {
      expect(item.classList.contains('sm:pointer-events-auto')).toBe(true);
    }

    // Hover category 1 (top category, col 1 row 1)
    items[0].dispatchEvent(new MouseEvent('mouseenter'));
    expect(component.hoveredCategory()).toBe(null); // debounced
    component.onCategoryHover(1);

    // Test direct selection on extra categories (e.g. #6, #8, #10)
    component.onCategoryClick(6);
    expect(component.selectedCategory()).toBe(6);
    expect(component.activeCategoryId()).toBe(6);

    component.onCategoryClick(10);
    expect(component.selectedCategory()).toBe(10);
    expect(component.activeCategoryId()).toBe(10);
  });

  it('should auto-collapse when deselecting an extra category that auto-expanded the list', () => {
    const eightCategories = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      name: `Cat ${i + 1}`,
      color: `#${i}${i}0000`,
      amount: (10 - i) * 100,
      pct: 12.5
    }));

    fixture.componentRef.setInput('breakdown', eightCategories);
    fixture.componentRef.setInput('totalAmount', 5500);
    fixture.detectChanges();

    expect(component.isExpanded()).toBe(false);

    // 1. Select extra category #7 (idx 6) -> should auto-expand
    component.onCategoryClick(7);
    fixture.detectChanges();
    expect(component.isExpanded()).toBe(true);
    expect(component.selectedCategory()).toBe(7);

    // 2. Click category #7 again to deselect -> should auto-collapse
    component.onCategoryClick(7);
    fixture.detectChanges();
    expect(component.isExpanded()).toBe(false);
    expect(component.selectedCategory()).toBe(null);

    // 3. Select extra category #8 -> should auto-expand
    component.onCategoryClick(8);
    fixture.detectChanges();
    expect(component.isExpanded()).toBe(true);

    // Deselect via clearSelection (e.g. clicking outside) -> should auto-collapse
    component.clearSelection();
    fixture.detectChanges();
    expect(component.isExpanded()).toBe(false);

    // 4. Select extra category #8 -> auto-expands
    component.onCategoryClick(8);
    fixture.detectChanges();
    expect(component.isExpanded()).toBe(true);

    // Select top category #1 -> should auto-collapse back
    component.onCategoryClick(1);
    fixture.detectChanges();
    expect(component.isExpanded()).toBe(false);
    expect(component.selectedCategory()).toBe(1);

    // 5. If manually expanded via toggleExpand, deselecting does NOT collapse
    component.toggleExpand();
    fixture.detectChanges();
    expect(component.isExpanded()).toBe(true);

    component.onCategoryClick(7);
    expect(component.selectedCategory()).toBe(7);

    component.onCategoryClick(7); // Deselect
    fixture.detectChanges();
    expect(component.selectedCategory()).toBe(null);
    expect(component.isExpanded()).toBe(true); // Should remain expanded because user opened it manually
  });
});

