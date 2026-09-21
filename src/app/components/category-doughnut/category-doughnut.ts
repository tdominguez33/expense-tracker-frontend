import { Component, input, signal, computed, HostListener, ElementRef, inject, OnDestroy } from '@angular/core';
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
  templateUrl: './category-doughnut.html'
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

  onCategoryClick(catId: number, event?: Event) {
    event?.stopPropagation();
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    this.selectedCategory.set(catId);
    this.hoveredCategory.set(null);
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
            this.selectedCategory.set(catId);
            this.hoveredCategory.set(null);
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
