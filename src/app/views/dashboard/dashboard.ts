import { Component, inject, OnInit, signal, computed, HostListener, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of, switchMap, map, catchError } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { CategoryDoughnut } from '../../components/category-doughnut/category-doughnut';

export type DashboardPeriod = 'day' | 'week' | 'month' | 'year';

export interface TimelineBar {
  label: string;
  fullLabel: string;
  amount: number;
  heightPct: number;
}

export interface TimelinePeak {
  label: string;
  amount: number;
}

export interface TimelineActiveCount {
  active: number;
  total: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CategoryDoughnut],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  readonly periods: readonly DashboardPeriod[] = ['day', 'week', 'month', 'year'] as const;

  readonly periodMetadata = [
    { period: 'day', label: 'Hoy', vsLabel: 'vs ayer', noDataLabel: 'Sin gastos ayer' },
    { period: 'week', label: 'Esta Semana', vsLabel: 'vs sem. ant.', noDataLabel: 'Sin gastos sem. ant.' },
    { period: 'month', label: 'Este Mes', vsLabel: 'vs mes ant.', noDataLabel: 'Sin gastos mes ant.' },
    { period: 'year', label: 'Este Año', vsLabel: 'vs año ant.', noDataLabel: 'Sin gastos año ant.' }
  ] as const;

  // Selected period state
  private _selectedPeriod = signal<string>('month');
  get selectedPeriod() { return this._selectedPeriod; }

  currentPeriodIndex = computed(() => {
    const p = this.selectedPeriod();
    const idx = this.periods.indexOf(p as DashboardPeriod);
    return idx >= 0 ? idx : 2;
  });

  generalReport = signal<any>(null);
  globalDebt = signal<number>(0);
  globalLimit = signal<number>(0);
  isLoading = signal<boolean>(true);
  errorMsg = signal<string>('');

  creditCards = signal<any[]>([]);
  creditCardsGridClass = computed(() => {
    const count = this.creditCards().length;
    if (count === 1) {
      return 'grid-cols-1';
    }
    if (count === 2) {
      return 'grid-cols-1 md:grid-cols-2';
    }
    return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
  });
  creditReports = signal<Record<number, any>>({});
  entities = signal<any[]>([]);
  categories = signal<any[]>([]);

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    this.errorMsg.set('');

    forkJoin({
      entities: this.api.getEntities().pipe(catchError(() => of([]))),
      categories: this.api.getCategories().pipe(catchError(() => of([]))),
      accounts: this.api.getAccounts().pipe(catchError(() => of([]))),
      general: this.api.getGeneralReport(),
      creditAll: this.api.getCreditAllReport().pipe(catchError(() => of(null)))
    })
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(res => {
        this.entities.set(res.entities || []);
        this.categories.set(res.categories || []);
        this.generalReport.set(res.general || null);
        this.globalDebt.set(res.creditAll?.total_global_debt || 0);
        this.globalLimit.set(res.creditAll?.total_available_limit || 0);

        const cards = (res.accounts || []).filter((a: any) => a.account_type === 'CREDIT_CARD');
        this.creditCards.set(cards);

        if (cards.length === 0) {
          this.creditReports.set({});
          return of([]);
        }

        const reportObservables = cards.map((card: any) =>
          this.api.getCreditReport(card.id).pipe(
            map((report: any) => ({ cardId: card.id, report })),
            catchError(() => of({ cardId: card.id, report: null }))
          )
        );

        return forkJoin(reportObservables);
      })
    )
    .subscribe({
      next: (cardReports: any) => {
        if (Array.isArray(cardReports) && cardReports.length > 0) {
          const reportsMap: Record<number, any> = {};
          cardReports.forEach(({ cardId, report }) => {
            if (report) {
              reportsMap[cardId] = report;
            }
          });
          this.creditReports.set(reportsMap);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.handleError(err);
      }
    });
  }

  private handleError(err: any) {
    console.error(err);
    this.errorMsg.set('Error conectando al servidor. Asegurate de que el backend esté corriendo y la URL configurada sea correcta.');
    this.isLoading.set(false);
  }

  getEntityName(entityId: number): string {
    const ent = this.entities().find(e => e.id === entityId);
    return ent ? `${ent.name} - ` : '';
  }

  getComparison(period: string): any {
    const report = this.generalReport();
    if (!report || !report.comparisons) return null;
    return report.comparisons[period] || null;
  }

  getComparisonTooltip(period: string): { title: string; subtitle: string } {
    const comp = this.getComparison(period);
    if (!comp) return { title: '', subtitle: '' };

    const periodLabels: Record<string, string> = {
      day: 'Ayer',
      week: 'Mismo punto sem. ant.',
      month: 'Mismo punto mes ant.',
      year: 'Mismo punto año ant.'
    };

    const label = periodLabels[period] || 'Período anterior';

    if (comp.previous === 0) {
      return {
        title: `${label}: Sin gastos ($0)`,
        subtitle: comp.current > 0
          ? `Gasto actual: $${Math.round(comp.current).toLocaleString('es-AR')}`
          : 'Sin gastos registrados'
      };
    }

    const diffPrefix = comp.diff > 0 ? '+' : '';
    return {
      title: `${label}: $${Math.round(comp.previous).toLocaleString('es-AR')}`,
      subtitle: `Diferencia: ${diffPrefix}$${Math.round(comp.diff).toLocaleString('es-AR')}`
    };
  }

  getCategoryColor(catId: any): string {
    if (catId == 0) return '#6b7280'; // gray for "Sin categoría"
    const cat = this.categories().find(c => c.id == catId);
    return cat ? cat.color : '#6b7280';
  }

  getCategoryName(catId: any): string {
    if (catId == 0) return 'Sin categoría';
    const cat = this.categories().find(c => c.id == catId);
    return cat ? cat.name : 'Desconocido';
  }

  getCategoryBreakdown(period: string): any[] {
    const report = this.generalReport();
    if (!report || !report.by_category || !report.by_category[period]) return [];

    const byCat = report.by_category[period];
    const total = report.totals[period] || 0;
    if (total === 0) return [];

    const breakdown = Object.entries(byCat)
      .map(([catIdStr, amount]: [string, any]) => {
        const catId = parseInt(catIdStr, 10);
        return {
          id: catId,
          amount: amount,
          color: this.getCategoryColor(catId),
          name: this.getCategoryName(catId),
          pct: 0
        };
      })
      .filter(c => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    // Largest Remainder Method to guarantee integer percentages that sum to 100
    let totalPct = 0;
    const remainders: { index: number, remainder: number }[] = [];

    breakdown.forEach((c, index) => {
      const rawPct = (c.amount / total) * 100;
      const floorPct = Math.floor(rawPct);
      c.pct = floorPct;
      totalPct += floorPct;
      remainders.push({ index, remainder: rawPct - floorPct });
    });

    let diff = 100 - totalPct;
    remainders.sort((a, b) => b.remainder - a.remainder);
    
    for (let i = 0; i < diff && i < remainders.length; i++) {
      breakdown[remainders[i].index].pct += 1;
    }

    return breakdown;
  }

  currentCategoryBreakdown = computed(() => {
    return this.getCategoryBreakdown(this.selectedPeriod());
  });

  maxCategoryAmount = computed(() => {
    const report = this.generalReport();
    if (!report?.by_category) return 0;
    let max = 0;
    for (const p of this.periods) {
      const byCat = report.by_category[p];
      if (byCat) {
        for (const val of Object.values(byCat)) {
          const amt = Number(val);
          if (!isNaN(amt) && amt > max) {
            max = amt;
          }
        }
      }
    }
    return max;
  });

  // Desktop doughnut card min-height computed signal
  desktopDoughnutMinHeight = computed<string>(() => {
    let maxAvailable = this.categories().length;
    
    // Check if any period has uncategorized expenses (catId === 0)
    const report = this.generalReport();
    if (report?.by_category) {
      for (const p of this.periods) {
        if ((report.by_category[p]?.[0] || 0) > 0 || (report.by_category[p]?.['0'] || 0) > 0) {
          maxAvailable = Math.max(maxAvailable, this.categories().length + 1);
          break;
        }
      }
    }

    // Also check if any period breakdown has more categories
    for (const p of this.periods) {
      const count = this.getCategoryBreakdown(p).length;
      if (count > maxAvailable) {
        maxAvailable = count;
      }
    }

    const count = Math.max(maxAvailable, 1);
    const rows = Math.ceil(count / 2);
    // Dynamic legend height: title (~36px) + rows (~40px each)
    const legendHeight = 36 + rows * 40;
    // Doughnut chart circle height on desktop (256px)
    const innerContentHeight = Math.max(256, legendHeight);
    // Compact vertical padding (py-4 to py-5: ~40px total) + 2px border
    const totalHeight = innerContentHeight + 42;
    // Stable desktop baseline (360px) ensuring all periods match perfectly in height
    return `${Math.max(totalHeight, 360)}px`;
  });

  getDesktopDoughnutMinHeight(): string {
    return this.desktopDoughnutMinHeight();
  }

  activeSlide = signal<number>(0);
  readonly TOTAL_SLIDES = 2;
  isChartSwiping = false;
  chartSwipeOffset = signal<number>(0);
  private chartTouchStartX = 0;
  private chartTouchStartY = 0;
  private isMouseDownOnChart = false;
  private chartMouseStartX = 0;

  getChartTransform(): string {
    const basePct = -this.activeSlide() * 100;
    const offsetPx = this.chartSwipeOffset();
    if (offsetPx !== 0) {
      return `translateX(calc(${basePct}% + ${offsetPx}px))`;
    }
    return `translateX(${basePct}%)`;
  }

  goToSlide(index: number) {
    if (this.selectedPeriod() === 'day' || index === this.activeSlide()) return;
    this.activeSlide.set(index);
    if (index === 1) {
      this.scrollToCurrentDay();
    }
  }

  nextSlide() {
    if (this.selectedPeriod() === 'day') return;
    this.goToSlide((this.activeSlide() + 1) % this.TOTAL_SLIDES);
  }

  prevSlide() {
    if (this.selectedPeriod() === 'day') return;
    this.goToSlide((this.activeSlide() - 1 + this.TOTAL_SLIDES) % this.TOTAL_SLIDES);
  }

  chartGestureDirection: 'none' | 'horizontal' | 'vertical' = 'none';

  onChartTouchStart(e: TouchEvent) {
    if (e.touches.length > 0) {
      this.chartTouchStartX = e.touches[0].clientX;
      this.chartTouchStartY = e.touches[0].clientY;
      this.isChartSwiping = false;
      this.chartSwipeOffset.set(0);
      this.chartGestureDirection = 'none';
    }
  }

  onChartTouchMove(e: TouchEvent) {
    if (this.selectedPeriod() === 'day' || e.touches.length === 0) return;
    if (this.chartGestureDirection === 'vertical') return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - this.chartTouchStartX;
    const deltaY = currentY - this.chartTouchStartY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (this.chartGestureDirection === 'none') {
      if (absX < 8 && absY < 8) return;

      // If vertical motion is significant, lock into vertical page scroll and ignore horizontal gestures
      if (absY >= absX * 0.75) {
        this.chartGestureDirection = 'vertical';
        this.isChartSwiping = false;
        this.chartSwipeOffset.set(0);
        return;
      }

      // Only lock into horizontal swipe if movement is clearly horizontal
      if (absX > 10 && absX > absY * 1.5) {
        this.chartGestureDirection = 'horizontal';
      } else {
        return;
      }
    }

    if (this.chartGestureDirection === 'horizontal') {
      this.isChartSwiping = true;
      let dampedDelta = deltaX;
      if ((this.activeSlide() === 0 && deltaX > 0) || (this.activeSlide() === 1 && deltaX < 0)) {
        dampedDelta = deltaX * 0.25;
      }
      this.chartSwipeOffset.set(dampedDelta);
    }
  }

  onChartTouchEnd(e: TouchEvent) {
    if (this.chartGestureDirection !== 'horizontal' || !this.isChartSwiping) {
      this.chartGestureDirection = 'none';
      this.isChartSwiping = false;
      this.chartSwipeOffset.set(0);
      return;
    }

    const offset = this.chartSwipeOffset();
    this.chartGestureDirection = 'none';
    this.isChartSwiping = false;
    this.chartSwipeOffset.set(0);

    if (offset < -45 && this.activeSlide() === 0) {
      this.goToSlide(1);
    } else if (offset > 45 && this.activeSlide() === 1) {
      this.goToSlide(0);
    }
  }

  onChartMouseDown(e: MouseEvent) {
    if (this.selectedPeriod() === 'day') return;
    this.isMouseDownOnChart = true;
    this.chartMouseStartX = e.clientX;
    this.chartSwipeOffset.set(0);
  }

  onChartMouseMove(e: MouseEvent) {
    if (!this.isMouseDownOnChart || this.selectedPeriod() === 'day') return;
    const deltaX = e.clientX - this.chartMouseStartX;
    if (Math.abs(deltaX) > 5) {
      this.isChartSwiping = true;
      let dampedDelta = deltaX;
      if ((this.activeSlide() === 0 && deltaX > 0) || (this.activeSlide() === 1 && deltaX < 0)) {
        dampedDelta = deltaX * 0.25;
      }
      this.chartSwipeOffset.set(dampedDelta);
    }
  }

  onChartMouseUp(e: MouseEvent) {
    if (!this.isMouseDownOnChart) return;
    this.isMouseDownOnChart = false;
    if (this.isChartSwiping) {
      const offset = this.chartSwipeOffset();
      this.isChartSwiping = false;
      this.chartSwipeOffset.set(0);
      if (offset < -40 && this.activeSlide() === 0) {
        this.goToSlide(1);
      } else if (offset > 40 && this.activeSlide() === 1) {
        this.goToSlide(0);
      }
    }
  }

  scrollToCurrentDay() {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    setTimeout(() => {
      const container = document.getElementById('timeline_scroll_container');
      if (container && this.selectedPeriod() === 'month') {
        const now = new Date();
        const currentDay = now.getDate();
        const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const scrollRatio = Math.max(0, (currentDay - 3) / totalDays);
        const targetScroll = container.scrollWidth * scrollRatio;
        container.scrollTo({ left: targetScroll, behavior: 'smooth' });
      }
    }, 100);
  }

  isCardsSwiping = false;
  cardsSwipeOffset = signal<number>(0);
  isNavigatingPeriod = false;
  private navPeriodTimeout: ReturnType<typeof setTimeout> | null = null;
  private wasSwipeGesture = false;
  private cardsTouchStartX = 0;
  private cardsTouchStartY = 0;
  private isMouseDownOnCards = false;
  private cardsMouseStartX = 0;

  getCardsTransform(): string {
    const basePct = -this.currentPeriodIndex() * 100;
    const offsetPx = this.cardsSwipeOffset();
    if (offsetPx !== 0) {
      return `translateX(calc(${basePct}% + ${offsetPx}px))`;
    }
    return `translateX(${basePct}%)`;
  }

  startPeriodNavLock(durationMs = 320) {
    this.isNavigatingPeriod = true;
    if (this.navPeriodTimeout) clearTimeout(this.navPeriodTimeout);
    this.navPeriodTimeout = setTimeout(() => {
      this.isNavigatingPeriod = false;
    }, durationMs);
  }

  cardsGestureDirection: 'none' | 'horizontal' | 'vertical' = 'none';

  onCardsTouchStart(e: TouchEvent) {
    if (e.touches.length > 0) {
      this.cardsTouchStartX = e.touches[0].clientX;
      this.cardsTouchStartY = e.touches[0].clientY;
      this.isCardsSwiping = false;
      this.cardsSwipeOffset.set(0);
      this.wasSwipeGesture = false;
      this.cardsGestureDirection = 'none';
    }
  }

  onCardsTouchMove(e: TouchEvent) {
    if (e.touches.length === 0) return;
    if (this.cardsGestureDirection === 'vertical') return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - this.cardsTouchStartX;
    const deltaY = currentY - this.cardsTouchStartY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (this.cardsGestureDirection === 'none') {
      if (absX < 8 && absY < 8) return;

      // If vertical motion is significant, lock into vertical page scroll
      if (absY >= absX * 0.75) {
        this.cardsGestureDirection = 'vertical';
        this.isCardsSwiping = false;
        this.cardsSwipeOffset.set(0);
        return;
      }

      // Only lock into horizontal swipe if movement is clearly horizontal
      if (absX > 10 && absX > absY * 1.5) {
        this.cardsGestureDirection = 'horizontal';
        this.wasSwipeGesture = true;
      } else {
        return;
      }
    }

    if (this.cardsGestureDirection === 'horizontal') {
      this.isCardsSwiping = true;
      let dampedDelta = deltaX;
      const idx = this.currentPeriodIndex();
      if ((idx === 0 && deltaX > 0) || (idx === this.periods.length - 1 && deltaX < 0)) {
        dampedDelta = deltaX * 0.25;
      }
      this.cardsSwipeOffset.set(dampedDelta);
    }
  }

  onCardsTouchEnd(e: TouchEvent) {
    if (this.cardsGestureDirection !== 'horizontal' || !this.isCardsSwiping) {
      this.cardsGestureDirection = 'none';
      this.isCardsSwiping = false;
      this.cardsSwipeOffset.set(0);
      setTimeout(() => {
        this.wasSwipeGesture = false;
      }, 200);
      return;
    }

    const offset = this.cardsSwipeOffset();
    this.cardsGestureDirection = 'none';
    this.isCardsSwiping = false;
    this.cardsSwipeOffset.set(0);
    setTimeout(() => {
      this.wasSwipeGesture = false;
    }, 200);

    // Limit to moving exactly one card!
    if (offset < -45) {
      this.startPeriodNavLock();
      this.goToNextPeriod();
    } else if (offset > 45) {
      this.startPeriodNavLock();
      this.goToPrevPeriod();
    }
  }

  onCardsMouseDown(e: MouseEvent) {
    this.isMouseDownOnCards = true;
    this.cardsMouseStartX = e.clientX;
    this.cardsSwipeOffset.set(0);
    this.wasSwipeGesture = false;
  }

  onCardsMouseMove(e: MouseEvent) {
    if (!this.isMouseDownOnCards) return;
    const deltaX = e.clientX - this.cardsMouseStartX;
    if (Math.abs(deltaX) > 5) {
      this.isCardsSwiping = true;
      this.wasSwipeGesture = true;
      let dampedDelta = deltaX;
      const idx = this.currentPeriodIndex();
      if ((idx === 0 && deltaX > 0) || (idx === this.periods.length - 1 && deltaX < 0)) {
        dampedDelta = deltaX * 0.25;
      }
      this.cardsSwipeOffset.set(dampedDelta);
    }
  }

  onCardsMouseUp(e: MouseEvent) {
    if (!this.isMouseDownOnCards) return;
    this.isMouseDownOnCards = false;
    if (this.isCardsSwiping) {
      const offset = this.cardsSwipeOffset();
      this.isCardsSwiping = false;
      this.cardsSwipeOffset.set(0);
      setTimeout(() => {
        this.wasSwipeGesture = false;
      }, 200);
      if (offset < -40) {
        this.startPeriodNavLock();
        this.goToNextPeriod();
      } else if (offset > 40) {
        this.startPeriodNavLock();
        this.goToPrevPeriod();
      }
    }
  }

  onCardPrevClick(event?: any) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (this.isNavigatingPeriod) return;
    this.startPeriodNavLock();
    this.goToPrevPeriod();
  }

  onCardNextClick(event?: any) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (this.isNavigatingPeriod) return;
    this.startPeriodNavLock();
    this.goToNextPeriod();
  }

  onCardClick(period: string) {
    if (this.wasSwipeGesture || this.isNavigatingPeriod) return;
    this.setPeriod(period);
  }

  onDotClick(period: string) {
    if (this.isNavigatingPeriod || period === this.selectedPeriod()) return;
    this.startPeriodNavLock();
    this.setPeriod(period);
  }

  setPeriod(period: string) {
    this._selectedPeriod.set(period);
    this.selectedTimelineBar.set(null);
    this.hoveredTimelineBar.set(null);
    if (period === 'day') {
      this.activeSlide.set(0);
    } else if (period === 'month' && this.activeSlide() === 1) {
      this.scrollToCurrentDay();
    }
  }

  goToNextPeriod() {
    const nextIdx = this.currentPeriodIndex() + 1;
    if (nextIdx < this.periods.length) {
      this.setPeriod(this.periods[nextIdx]);
    }
  }

  goToPrevPeriod() {
    const prevIdx = this.currentPeriodIndex() - 1;
    if (prevIdx >= 0) {
      this.setPeriod(this.periods[prevIdx]);
    }
  }

  getPeriodTitle(): string {
    const p = this.selectedPeriod();
    return p === 'day' ? 'Hoy' : p === 'week' ? 'Esta Semana' : p === 'month' ? 'Este Mes' : 'Este Año';
  }

  timelineData = computed<TimelineBar[]>(() => {
    const report = this.generalReport();
    const period = this.selectedPeriod();
    if (!report || !report.timeline || period === 'day') return [];

    const timeline = report.timeline[period];
    if (!timeline) return [];

    let data: TimelineBar[] = [];
    let maxAmount = 0;

    if (period === 'week') {
      const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
      const fullDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      for (let i = 0; i < 7; i++) {
        const amt = timeline[i] || 0;
        if (amt > maxAmount) maxAmount = amt;
        data.push({ label: days[i], fullLabel: fullDays[i], amount: amt, heightPct: 0 });
      }
    } else if (period === 'month') {
      const now = new Date();
      const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      for (let i = 1; i <= totalDays; i++) {
        const amt = timeline[i] || 0;
        if (amt > maxAmount) maxAmount = amt;
        data.push({ label: i.toString(), fullLabel: `Día ${i}`, amount: amt, heightPct: 0 });
      }
    } else if (period === 'year') {
      const months = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
      const fullMonths = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      for (let i = 1; i <= 12; i++) {
        const amt = timeline[i] || 0;
        if (amt > maxAmount) maxAmount = amt;
        data.push({ label: months[i - 1], fullLabel: fullMonths[i - 1], amount: amt, heightPct: 0 });
      }
    }

    if (maxAmount > 0) {
      data = data.map(d => ({ ...d, heightPct: (d.amount / maxAmount) * 100 }));
    }

    return data;
  });

  getTimelineData(): TimelineBar[] {
    return this.timelineData();
  }

  timelineAverage = computed<string>(() => {
    const report = this.generalReport();
    const period = this.selectedPeriod();
    if (!report || period === 'day') return '';

    const total = report.totals?.[period] || 0;
    const now = new Date();
    
    if (period === 'week') {
      const jsDay = now.getDay();
      const elapsedDays = jsDay === 0 ? 7 : jsDay;
      const avg = total / elapsedDays;
      return `$${avg.toLocaleString('es-AR', { maximumFractionDigits: 0 })}/día`;
    } else if (period === 'month') {
      const elapsedDays = Math.max(1, now.getDate());
      const avg = total / elapsedDays;
      return `$${avg.toLocaleString('es-AR', { maximumFractionDigits: 0 })}/día`;
    } else if (period === 'year') {
      const yearTimeline = report.timeline?.year || {};
      const currentMonth = now.getMonth() + 1;
      let activeMonths = 0;
      for (let m = 1; m <= currentMonth; m++) {
        if ((yearTimeline[m] || 0) > 0) {
          activeMonths++;
        }
      }
      if (activeMonths === 0) {
        return '$0/mes';
      }
      const avg = total / activeMonths;
      return `$${avg.toLocaleString('es-AR', { maximumFractionDigits: 0 })}/mes`;
    }
    return '';
  });

  getTimelineAverage(): string {
    return this.timelineAverage();
  }

  timelineAverageTooltip = computed<string>(() => {
    const report = this.generalReport();
    const period = this.selectedPeriod();
    if (!report || period === 'day') return '';
    const now = new Date();
    if (period === 'week') {
      const jsDay = now.getDay();
      const elapsed = jsDay === 0 ? 7 : jsDay;
      return `Promedio sobre ${elapsed} ${elapsed === 1 ? 'día transcurrido' : 'días transcurridos'}`;
    } else if (period === 'month') {
      const elapsed = Math.max(1, now.getDate());
      return `Promedio sobre ${elapsed} ${elapsed === 1 ? 'día transcurrido' : 'días transcurridos'}`;
    } else if (period === 'year') {
      const yearTimeline = report.timeline?.year || {};
      const currentMonth = now.getMonth() + 1;
      let activeMonths = 0;
      for (let m = 1; m <= currentMonth; m++) {
        if ((yearTimeline[m] || 0) > 0) {
          activeMonths++;
        }
      }
      if (activeMonths === 0) {
        return 'Sin meses con gastos registrados';
      }
      return `Promedio sobre ${activeMonths} ${activeMonths === 1 ? 'mes con gastos' : 'meses con gastos'}`;
    }
    return '';
  });

  getTimelineAverageTooltip(): string {
    return this.timelineAverageTooltip();
  }

  selectedTimelineBar = signal<TimelineBar | null>(null);
  hoveredTimelineBar = signal<TimelineBar | null>(null);

  activeTimelineBar = computed(() => this.hoveredTimelineBar() ?? this.selectedTimelineBar());

  private touchStartX = 0;
  private touchStartY = 0;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as Element | null;
    const isTimelineBar = target?.closest('[data-timeline-bar]');
    if (!isTimelineBar && (this.selectedTimelineBar() !== null || this.hoveredTimelineBar() !== null)) {
      this.selectedTimelineBar.set(null);
      this.hoveredTimelineBar.set(null);
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
        const isTimelineBar = target?.closest('[data-timeline-bar]');
        if (!isTimelineBar && (this.selectedTimelineBar() !== null || this.hoveredTimelineBar() !== null)) {
          this.selectedTimelineBar.set(null);
          this.hoveredTimelineBar.set(null);
        }
      }
    }
  }

  selectTimelineBar(bar: TimelineBar, event?: Event) {
    if (this.isChartSwiping || Math.abs(this.chartSwipeOffset()) > 5) return;
    event?.stopPropagation();
    if (this.selectedTimelineBar()?.fullLabel === bar.fullLabel) {
      this.selectedTimelineBar.set(null);
    } else {
      this.selectedTimelineBar.set(bar);
    }
    this.hoveredTimelineBar.set(null);
  }

  hoverTimelineBar(bar: TimelineBar) {
    this.hoveredTimelineBar.set(bar);
  }

  leaveTimelineBar() {
    this.hoveredTimelineBar.set(null);
  }

  timelinePeak = computed<TimelinePeak | null>(() => {
    const data = this.timelineData();
    if (!data.length) return null;
    let peak = data[0];
    for (const d of data) {
      if (d.amount > peak.amount) {
        peak = d;
      }
    }
    return peak.amount > 0 ? { label: peak.fullLabel, amount: peak.amount } : null;
  });

  getTimelinePeak(): TimelinePeak | null {
    return this.timelinePeak();
  }

  timelineActiveCount = computed<TimelineActiveCount>(() => {
    const data = this.timelineData();
    const active = data.filter(d => d.amount > 0).length;
    return { active, total: data.length };
  });

  getTimelineActiveCount(): TimelineActiveCount {
    return this.timelineActiveCount();
  }

  timelineMonthRows = computed<TimelineBar[][]>(() => {
    const data = this.timelineData();
    if (this.selectedPeriod() !== 'month' || data.length <= 15) {
      return [data];
    }
    return [
      data.slice(0, 15),
      data.slice(15)
    ];
  });

  getTimelineMonthRows(): TimelineBar[][] {
    return this.timelineMonthRows();
  }
}
