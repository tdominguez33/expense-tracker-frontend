import { Component, input, signal, computed, HostListener, ElementRef, inject, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CategoryBreakdownItem {
  id: number;
  name: string;
  color: string;
  amount: number;
  pct: number;
  count?: number;
}

@Component({
  selector: 'app-category-doughnut',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './category-doughnut.html',
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
    .expand-grid {
      display: grid;
      grid-template-rows: 0fr;
      opacity: 0;
      pointer-events: none;
      transition: grid-template-rows 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 250ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .expand-grid.expanded {
      grid-template-rows: 1fr;
      opacity: 1;
      pointer-events: auto;
    }
    @media (min-width: 640px) {
      .expand-grid {
        display: contents !important;
      }
      .expand-grid-inner {
        display: contents !important;
      }
    }
  `]
})
export class CategoryDoughnut implements OnDestroy {
  private static idCounter = 0;
  readonly maskId = `doughnut-mask-${++CategoryDoughnut.idCounter}`;
  private el = inject(ElementRef);

  breakdown = input<CategoryBreakdownItem[]>([]);
  totalAmount = input<number>(0);
  periodTitle = input<string>('');
  emptyMessage = input<string>('No hay gastos en este período.');
  showLegend = input<boolean>(true);
  maxAmount = input<number>(0);

  topCategories = computed(() => this.breakdown().slice(0, 5));
  extraCategories = computed(() => this.breakdown().slice(5));

  effectiveMaxAmount = computed(() => {
    const fromInput = this.maxAmount();
    if (fromInput > 0) return fromInput;
    const items = this.breakdown();
    if (!items.length) return 0;
    return Math.max(...items.map(i => i.amount));
  });

  amountMinWidthCh = computed(() => {
    const max = this.effectiveMaxAmount();
    if (max <= 0) return 4;
    const formatted = '$' + Math.round(max).toLocaleString('es-AR');
    return formatted.length + 0.5;
  });

  isExpanded = signal<boolean>(false);
  private previousBreakdownKey: string | null = null;

  constructor() {
    effect(() => {
      const title = this.periodTitle();
      const items = this.breakdown();
      // Track actual semantic identity (period + category IDs) instead of object reference
      const currentKey = `${title}|${items.map(i => i.id).join(',')}`;
      if (this.previousBreakdownKey !== null && this.previousBreakdownKey !== currentKey) {
        this.isExpanded.set(false);
        this.deselectIfHidden();
      }
      this.previousBreakdownKey = currentKey;
    });
  }

  toggleExpand(event?: Event) {
    event?.stopPropagation();
    const nextExpanded = !this.isExpanded();
    this.isExpanded.set(nextExpanded);
    if (!nextExpanded) {
      this.deselectIfHidden();
    }
  }

  private deselectIfHidden() {
    const selectedId = this.selectedCategory();
    if (selectedId !== null) {
      const isExtra = this.extraCategories().some(c => c.id === selectedId);
      if (isExtra) {
        this.clearSelection();
      }
    }
  }

  hoveredCategory = signal<number | null>(null);
  selectedCategory = signal<number | null>(null);

  activeCategoryId = computed(() => this.hoveredCategory() ?? this.selectedCategory());

  private hoverTimer: any = null;
  private touchStartX = 0;
  private touchStartY = 0;

  renderKey = computed(() => {
    const items = this.breakdown();
    const title = this.periodTitle();
    return `${title}-${items.map(i => `${i.id}:${i.pct}`).join(',')}`;
  });

  onCategoryHover(catId: number) {
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    this.hoverTimer = setTimeout(() => {
      this.hoveredCategory.set(catId);
    }, 75);
  }

  onCategoryLeave() {
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    this.hoverTimer = setTimeout(() => {
      this.hoveredCategory.set(null);
    }, 75);
  }

  private lastTouchHandledTime = 0;

  toggleCategorySelection(catId: number) {
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    if (this.selectedCategory() === catId) {
      this.clearSelection();
      return;
    }
    this.selectedCategory.set(catId);
    this.hoveredCategory.set(null);
    const idx = this.breakdown().findIndex(c => c.id === catId);
    if (idx >= 5 && !this.isExpanded()) {
      this.isExpanded.set(true);
    }
  }

  onCategoryClick(catId: number, event?: Event) {
    event?.stopPropagation();
    if (Date.now() - this.lastTouchHandledTime < 500) {
      return;
    }
    this.toggleCategorySelection(catId);
  }

  clearSelection() {
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    this.selectedCategory.set(null);
    this.hoveredCategory.set(null);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as Element | null;
    const isInside = this.el.nativeElement.contains(target);
    const categoryEl = isInside ? target?.closest('[data-category-id]') : null;
    if (!categoryEl) {
      this.clearSelection();
    }
  }

  @HostListener('document:touchstart', ['$event'])
  onTouchStart(event: TouchEvent) {
    if (event.touches.length > 0) {
      this.touchStartX = event.touches[0].clientX;
      this.touchStartY = event.touches[0].clientY;
    }
  }

  @HostListener('document:touchend', ['$event'])
  onTouchEnd(event: TouchEvent) {
    if (event.changedTouches.length > 0) {
      const deltaX = Math.abs(event.changedTouches[0].clientX - this.touchStartX);
      const deltaY = Math.abs(event.changedTouches[0].clientY - this.touchStartY);
      if (deltaX < 10 && deltaY < 10) {
        const target = event.target as Element | null;
        const isInside = this.el.nativeElement.contains(target);
        const categoryEl = isInside ? target?.closest('[data-category-id]') : null;
        if (categoryEl) {
          const rawId = categoryEl.getAttribute('data-category-id');
          const catId = rawId !== null ? Number(rawId) : NaN;
          if (!isNaN(catId)) {
            this.lastTouchHandledTime = Date.now();
            this.toggleCategorySelection(catId);
          }
        } else {
          this.clearSelection();
        }
      }
    }
  }

  ngOnDestroy() {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
    }
  }

  getHoveredInfo(): { name: string; amount: number; color?: string } {
    const catId = this.activeCategoryId();
    if (catId !== null) {
      const cat = this.breakdown().find(c => c.id === catId);
      if (cat) {
        return { name: cat.name, amount: cat.amount, color: cat.color };
      }
    }

    const title = this.periodTitle();
    return {
      name: title ? (title.toLowerCase().startsWith('total') ? title : `Total ${title}`) : 'Total',
      amount: this.totalAmount()
    };
  }

  getSvgBreakdown(): any[] {
    const list = this.breakdown();
    let cumulative = 0;

    return list.map(cat => {
      const offset = 100 - cumulative;
      const item = {
        ...cat,
        dasharray: `${cat.pct} ${100 - cat.pct}`,
        offset: offset
      };
      cumulative += cat.pct;
      return item;
    });
  }
}
