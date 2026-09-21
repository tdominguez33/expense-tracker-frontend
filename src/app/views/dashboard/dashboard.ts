import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { CategoryDoughnut } from '../../components/category-doughnut/category-doughnut';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CategoryDoughnut],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  private api = inject(ApiService);

  generalReport = signal<any>(null);
  globalDebt = signal<number>(0);
  globalLimit = signal<number>(0);
  isLoading = signal<boolean>(true);
  errorMsg = signal<string>('');

  creditCards = signal<any[]>([]);
  creditReports = signal<{[key: number]: any}>({});
  entities = signal<any[]>([]);
  categories = signal<any[]>([]);

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    this.errorMsg.set('');

    this.api.getEntities().subscribe(ents => this.entities.set(ents));
    this.api.getCategories().subscribe(cats => this.categories.set(cats));

    // Fetch accounts to get credit cards
    this.api.getAccounts().subscribe({
      next: (accs) => {
        const cards = accs.filter((a: any) => a.account_type === 'CREDIT_CARD');
        this.creditCards.set(cards);
        
        let reports: any = {};
        cards.forEach((card: any) => {
          this.api.getCreditReport(card.id).subscribe(report => {
            reports[card.id] = report;
            this.creditReports.set({...reports});
          });
        });
      },
      error: (err) => this.handleError(err)
    });

    // Fetch both global reports
    this.api.getGeneralReport().subscribe({
      next: (genData) => {
        this.generalReport.set(genData);
        
        this.api.getCreditAllReport().subscribe({
          next: (credData) => {
            this.globalDebt.set(credData?.total_global_debt || 0);
            this.globalLimit.set(credData?.total_available_limit || 0);
            this.isLoading.set(false);
          },
          error: (err) => {
            this.handleError(err);
          }
        });
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

  getComparison(period: 'day' | 'week' | 'month' | 'year'): any {
    const report = this.generalReport();
    if (!report || !report.comparisons) return null;
    return report.comparisons[period] || null;
  }

  getComparisonTooltip(period: 'day' | 'week' | 'month' | 'year'): { title: string; subtitle: string } {
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

  activeSlide = signal<number>(0);
  readonly TOTAL_SLIDES = 2;
  animatingSlide = signal<{ from: number; to: number; direction: 'next' | 'prev' } | null>(null);
  private animTimeout: any = null;

  nextSlide() {
    if (this.selectedPeriod() === 'day' || this.animatingSlide() !== null) return;
    const from = this.activeSlide();
    const to = (from + 1) % this.TOTAL_SLIDES;
    this.startSlideAnimation(from, to, 'next');
  }

  prevSlide() {
    if (this.selectedPeriod() === 'day' || this.animatingSlide() !== null) return;
    const from = this.activeSlide();
    const to = (from - 1 + this.TOTAL_SLIDES) % this.TOTAL_SLIDES;
    this.startSlideAnimation(from, to, 'prev');
  }

  private startSlideAnimation(from: number, to: number, direction: 'next' | 'prev') {
    if (this.animTimeout) {
      clearTimeout(this.animTimeout);
    }
    this.animatingSlide.set({ from, to, direction });
    this.animTimeout = setTimeout(() => {
      this.activeSlide.set(to);
      this.animatingSlide.set(null);
    }, 400);
  }

  getSlideClass(slideIndex: number): string {
    const anim = this.animatingSlide();
    if (anim) {
      if (slideIndex === anim.from) {
        return anim.direction === 'next' ? 'slide-out-left z-10' : 'slide-out-right z-10';
      }
      if (slideIndex === anim.to) {
        return anim.direction === 'next' ? 'slide-in-right z-20' : 'slide-in-left z-20';
      }
      return 'invisible opacity-0 pointer-events-none z-0';
    }

    if (slideIndex === this.activeSlide()) {
      return 'opacity-100 z-10 pointer-events-auto';
    }
    return 'invisible opacity-0 pointer-events-none z-0';
  }
  
  // Track selected period and reset slide if needed
  private _selectedPeriod = signal<string>('month');
  get selectedPeriod() { return this._selectedPeriod; }
  
  setPeriod(period: string) {
    this._selectedPeriod.set(period);
    if (period === 'day') {
      if (this.animTimeout) {
        clearTimeout(this.animTimeout);
      }
      this.activeSlide.set(0);
      this.animatingSlide.set(null);
    }
  }

  getPeriodTitle(): string {
    const p = this.selectedPeriod();
    return p === 'day' ? 'Hoy' : p === 'week' ? 'Esta Semana' : p === 'month' ? 'Este Mes' : 'Este Año';
  }

  hoveredCategory = signal<number | null>(null);
  private hoverTimer: any = null;

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

  getHoveredInfo(): { name: string, amount: number, color?: string } {
    const catId = this.hoveredCategory();
    const period = this.selectedPeriod();
    const report = this.generalReport();
    
    if (catId !== null) {
      const breakdown = this.getCategoryBreakdown(period);
      const cat = breakdown.find(c => c.id === catId);
      if (cat) {
        return { name: cat.name, amount: cat.amount, color: cat.color };
      }
    }
    
    return { 
      name: period === 'day' ? 'Total Hoy' : period === 'week' ? 'Total Semana' : period === 'month' ? 'Total Mes' : 'Total Año', 
      amount: report?.totals?.[period] || 0 
    };
  }

  getCategoryBreakdownSVG(): any[] {
    const breakdown = this.getCategoryBreakdown(this.selectedPeriod());
    let cumulative = 0;
    
    return breakdown.map(cat => {
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

  getTimelineData(): { label: string, fullLabel: string, amount: number, heightPct: number }[] {
    const report = this.generalReport();
    const period = this.selectedPeriod();
    if (!report || !report.timeline || period === 'day') return [];

    const timeline = report.timeline[period];
    if (!timeline) return [];

    let data: { label: string, fullLabel: string, amount: number, heightPct: number }[] = [];
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
      const totalDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
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
  }

  getTimelineAverage(): string {
    const report = this.generalReport();
    const period = this.selectedPeriod();
    if (!report || period === 'day') return '';

    const total = report.totals[period] || 0;
    const now = new Date();
    
    if (period === 'week') {
      const jsDay = now.getDay();
      const elapsedDays = jsDay === 0 ? 7 : jsDay;
      const avg = total / elapsedDays;
      return `$${avg.toLocaleString('es-AR', {maximumFractionDigits: 0})}/día`;
    } else if (period === 'month') {
      const elapsedDays = Math.max(1, now.getDate());
      const avg = total / elapsedDays;
      return `$${avg.toLocaleString('es-AR', {maximumFractionDigits: 0})}/día`;
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
      return `$${avg.toLocaleString('es-AR', {maximumFractionDigits: 0})}/mes`;
    }
    return '';
  }

  getTimelineAverageTooltip(): string {
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
  }
}
