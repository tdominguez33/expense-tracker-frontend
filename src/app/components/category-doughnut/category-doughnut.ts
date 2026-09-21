import { Component, input, signal, computed } from '@angular/core';
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
export class CategoryDoughnut {
  private static idCounter = 0;
  readonly maskId = `doughnut-mask-${++CategoryDoughnut.idCounter}`;

  breakdown = input<CategoryBreakdownItem[]>([]);
  totalAmount = input<number>(0);
  periodTitle = input<string>('');
  emptyMessage = input<string>('No hay gastos en este período.');
  showLegend = input<boolean>(true);

  hoveredCategory = signal<number | null>(null);
  private hoverTimer: any = null;

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

  getHoveredInfo(): { name: string; amount: number; color?: string } {
    const catId = this.hoveredCategory();
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
