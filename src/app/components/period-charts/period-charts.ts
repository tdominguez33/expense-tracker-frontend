import { Component, input, output, signal, computed, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoryDoughnut, CategoryBreakdownItem } from '../category-doughnut/category-doughnut';

export interface TimelineBarItem {
  label: string;
  fullLabel: string;
  amount: number;
  heightPct?: number;
  count?: number;
  dateKey?: string;
}

export interface TimelinePeakInfo {
  label: string;
  amount: number;
}

export interface TimelineActiveCountInfo {
  active: number;
  total: number;
}

@Component({
  selector: 'app-period-charts',
  standalone: true,
  imports: [CommonModule, CategoryDoughnut],
  templateUrl: './period-charts.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .will-change-transform {
      will-change: transform;
    }
    @media (min-width: 768px) {
      .period-charts-slide-card {
        min-height: var(--desktop-chart-min-h, 380px);
      }
    }
  `]
})
export class PeriodCharts {
  // Inputs
  breakdown = input<CategoryBreakdownItem[]>([]);
  totalAmount = input<number>(0);
  periodTitle = input<string>('');
  categoriesTitle = input<string>('Desglose por Categorías');
  categoriesSubtitle = input<string>('');
  timelineTitle = input<string>('Evolución en el Tiempo');
  timelineSubtitle = input<string>('');
  timelineData = input<TimelineBarItem[]>([]);
  isMonthView = input<boolean>(true);
  averageText = input<string>('');
  averageTooltip = input<string>('');
  selectedBarKey = input<string | null>(null);
  emptyMessage = input<string>('No se registraron gastos en este período.');
  maxCategoryAmount = input<number>(0);
  showControls = input<boolean>(true);
  minHeight = input<string>('380px');

  // Outputs
  barClick = output<TimelineBarItem>();
  slideChange = output<number>();

  // Carousel state
  activeSlide = signal<number>(0);
  readonly TOTAL_SLIDES = 2;
  isSwiping = false;
  swipeOffset = signal<number>(0);
  private touchStartX = 0;
  private touchStartY = 0;
  private isMouseDown = false;
  private mouseStartX = 0;
  private gestureDirection: 'none' | 'horizontal' | 'vertical' = 'none';

  // Bar interaction state
  selectedBar = signal<TimelineBarItem | null>(null);
  hoveredBar = signal<TimelineBarItem | null>(null);

  // Processed timeline data with computed heights
  processedTimelineData = computed<TimelineBarItem[]>(() => {
    const data = this.timelineData();
    if (!data || data.length === 0) return [];

    let maxAmount = 0;
    for (const item of data) {
      if (item.amount > maxAmount) {
        maxAmount = item.amount;
      }
    }

    return data.map(item => {
      let hPct = item.heightPct;
      if (hPct === undefined) {
        hPct = maxAmount > 0 ? Math.max(4, Math.round((item.amount / maxAmount) * 100)) : 4;
      }
      return {
        ...item,
        heightPct: item.amount > 0 ? Math.max(hPct, 4) : 0
      };
    });
  });

  // Timeline Peak (highest expense)
  timelinePeak = computed<TimelinePeakInfo | null>(() => {
    const data = this.processedTimelineData();
    if (!data.length) return null;
    let peak = data[0];
    for (const d of data) {
      if (d.amount > peak.amount) {
        peak = d;
      }
    }
    return peak.amount > 0 ? { label: peak.fullLabel, amount: peak.amount } : null;
  });

  // Timeline Active Count (days/months with expenses vs total)
  timelineActiveCount = computed<TimelineActiveCountInfo>(() => {
    const data = this.processedTimelineData();
    const active = data.filter(d => d.amount > 0).length;
    return { active, total: data.length };
  });

  // Responsive month rows for mobile layout (días 1-15, días 16-fin)
  timelineMonthRows = computed<TimelineBarItem[][]>(() => {
    const data = this.processedTimelineData();
    if (!this.isMonthView() || data.length <= 15) {
      return [data];
    }
    return [
      data.slice(0, 15),
      data.slice(15)
    ];
  });

  // Currently active bar (hovered > externally selected by key > internally selected)
  activeBar = computed<TimelineBarItem | null>(() => {
    if (this.hoveredBar()) {
      return this.hoveredBar();
    }
    const key = this.selectedBarKey();
    const data = this.processedTimelineData();
    if (key) {
      const found = data.find(b => b.dateKey === key);
      if (found) return found;
    }
    if (this.selectedBar()) {
      return this.selectedBar();
    }
    return null;
  });

  isBarActive(bar: TimelineBarItem): boolean {
    if (this.hoveredBar() && this.hoveredBar()?.fullLabel === bar.fullLabel) {
      return true;
    }
    const key = this.selectedBarKey();
    if (key && bar.dateKey && key === bar.dateKey) {
      return true;
    }
    if (this.selectedBar()) {
      if (bar.dateKey && this.selectedBar()?.dateKey === bar.dateKey) {
        return true;
      }
      if (this.selectedBar()?.fullLabel === bar.fullLabel) {
        return true;
      }
    }
    return false;
  }

  getChartTransform(): string {
    const basePct = -this.activeSlide() * 100;
    const offsetPx = this.swipeOffset();
    if (offsetPx !== 0) {
      return `translateX(calc(${basePct}% + ${offsetPx}px))`;
    }
    return `translateX(${basePct}%)`;
  }

  goToSlide(index: number) {
    if (index === this.activeSlide() || index < 0 || index >= this.TOTAL_SLIDES) return;
    this.activeSlide.set(index);
    this.slideChange.emit(index);
  }

  nextSlide() {
    this.goToSlide((this.activeSlide() + 1) % this.TOTAL_SLIDES);
  }

  prevSlide() {
    this.goToSlide((this.activeSlide() - 1 + this.TOTAL_SLIDES) % this.TOTAL_SLIDES);
  }

  // Touch swipe gesture handling
  onChartTouchStart(e: TouchEvent) {
    if (e.touches.length > 0) {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.isSwiping = false;
      this.swipeOffset.set(0);
      this.gestureDirection = 'none';
    }
  }

  onChartTouchMove(e: TouchEvent) {
    if (e.touches.length === 0) return;
    if (this.gestureDirection === 'vertical') return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - this.touchStartX;
    const deltaY = currentY - this.touchStartY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (this.gestureDirection === 'none') {
      if (absX < 8 && absY < 8) return;

      // Lock vertical scroll if user is scrolling up/down
      if (absY >= absX * 0.75) {
        this.gestureDirection = 'vertical';
        this.isSwiping = false;
        this.swipeOffset.set(0);
        return;
      }

      // Lock horizontal swipe if user is clearly swiping left/right
      if (absX > 10 && absX > absY * 1.5) {
        this.gestureDirection = 'horizontal';
      } else {
        return;
      }
    }

    if (this.gestureDirection === 'horizontal') {
      this.isSwiping = true;
      let dampedDelta = deltaX;
      if ((this.activeSlide() === 0 && deltaX > 0) || (this.activeSlide() === 1 && deltaX < 0)) {
        dampedDelta = deltaX * 0.25;
      }
      this.swipeOffset.set(dampedDelta);
    }
  }

  onChartTouchEnd(e: TouchEvent) {
    if (this.gestureDirection !== 'horizontal' || !this.isSwiping) {
      this.gestureDirection = 'none';
      this.isSwiping = false;
      this.swipeOffset.set(0);
      return;
    }

    const offset = this.swipeOffset();
    this.gestureDirection = 'none';
    this.isSwiping = false;
    this.swipeOffset.set(0);

    if (offset < -45 && this.activeSlide() === 0) {
      this.goToSlide(1);
    } else if (offset > 45 && this.activeSlide() === 1) {
      this.goToSlide(0);
    }
  }

  // Mouse drag gesture handling
  onChartMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    this.isMouseDown = true;
    this.mouseStartX = e.clientX;
    this.swipeOffset.set(0);
  }

  onChartMouseMove(e: MouseEvent) {
    if (!this.isMouseDown) return;
    const deltaX = e.clientX - this.mouseStartX;
    if (Math.abs(deltaX) > 5) {
      this.isSwiping = true;
      let dampedDelta = deltaX;
      if ((this.activeSlide() === 0 && deltaX > 0) || (this.activeSlide() === 1 && deltaX < 0)) {
        dampedDelta = deltaX * 0.25;
      }
      this.swipeOffset.set(dampedDelta);
    }
  }

  onChartMouseUp(e: MouseEvent) {
    if (!this.isMouseDown) return;
    this.isMouseDown = false;
    if (this.isSwiping) {
      const offset = this.swipeOffset();
      this.isSwiping = false;
      this.swipeOffset.set(0);
      if (offset < -40 && this.activeSlide() === 0) {
        this.goToSlide(1);
      } else if (offset > 40 && this.activeSlide() === 1) {
        this.goToSlide(0);
      }
    }
  }

  // Bar click & hover
  onBarClick(bar: TimelineBarItem, event?: Event) {
    if (this.isSwiping || Math.abs(this.swipeOffset()) > 5) return;
    event?.stopPropagation();

    if (bar.amount > 0) {
      const isCurrentlySelected =
        this.selectedBar()?.fullLabel === bar.fullLabel ||
        (bar.dateKey && this.selectedBarKey() === bar.dateKey);

      if (isCurrentlySelected) {
        this.selectedBar.set(null);
      } else {
        this.selectedBar.set(bar);
      }
    }
    this.hoveredBar.set(null);
    this.barClick.emit(bar);
  }

  hoverBar(bar: TimelineBarItem) {
    if (bar.amount > 0) {
      this.hoveredBar.set(bar);
    }
  }

  leaveBar() {
    this.hoveredBar.set(null);
  }

  private docTouchStartX = 0;
  private docTouchStartY = 0;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as Element | null;
    const isTimelineBar = target?.closest('[data-timeline-bar]');
    if (!isTimelineBar && (this.selectedBar() !== null || this.hoveredBar() !== null)) {
      this.selectedBar.set(null);
      this.hoveredBar.set(null);
    }
  }

  @HostListener('document:touchstart', ['$event'])
  onDocTouchStart(event: TouchEvent) {
    if (event.touches.length > 0) {
      this.docTouchStartX = event.touches[0].clientX;
      this.docTouchStartY = event.touches[0].clientY;
    }
  }

  @HostListener('document:touchend', ['$event'])
  onDocTouchEnd(event: TouchEvent) {
    if (event.changedTouches.length > 0) {
      const deltaX = Math.abs(event.changedTouches[0].clientX - this.docTouchStartX);
      const deltaY = Math.abs(event.changedTouches[0].clientY - this.docTouchStartY);
      if (deltaX < 10 && deltaY < 10) {
        const target = event.target as Element | null;
        const isTimelineBar = target?.closest('[data-timeline-bar]');
        if (!isTimelineBar && (this.selectedBar() !== null || this.hoveredBar() !== null)) {
          this.selectedBar.set(null);
          this.hoveredBar.set(null);
        }
      }
    }
  }
}
