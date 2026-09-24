import { Component, inject, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { CategoryBreakdownItem } from '../../components/category-doughnut/category-doughnut';
import { PeriodCharts } from '../../components/period-charts/period-charts';
import { DEFAULT_PAGE_SIZE } from '../transactions/transactions';
import { getContrastColor } from '../../utils/color';

export const SPINNER_DELAY_MS = 250;

export type SortColumn = 'date' | 'description' | 'category' | 'account' | 'installments' | 'amount';
export type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, PeriodCharts],
  templateUrl: './history.html',
  styleUrl: './history.css'
})
export class HistoryView implements OnInit, OnDestroy {
  protected readonly Math = Math;
  private api = inject(ApiService);

  getTextColorForBackground(hexColor: string): string {
    return getContrastColor(hexColor);
  }

  isLoading = signal<boolean>(false);
  showSpinner = signal<boolean>(false);
  hasLoadedOnce = signal<boolean>(false);
  private loadingTimeout: any = null;
  errorMsg = signal<string>('');

  selectedYear = signal<number>(new Date().getFullYear());
  selectedMonth = signal<number | null>(null);

  reportData = signal<any>(null);
  availableYears = signal<number[]>([new Date().getFullYear()]);
  availableMonths = signal<number[]>([]);
  availablePeriods = signal<{ [year: number]: number[] }>({});

  categoryFilter = signal<number | null>(null);
  dateFilter = signal<string>('');
  searchQuery = signal<string>('');
  hoveredBarIndex = signal<number | null>(null);

  sortColumn = signal<SortColumn | null>(null);
  sortDirection = signal<SortDirection | null>(null);

  currentPage = signal<number>(1);
  pageSize = signal<number>(DEFAULT_PAGE_SIZE);

  readonly monthShortNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  readonly monthFullNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  ngOnInit() {
    this.initDefaultPeriod();
    this.loadReport();
  }

  ngOnDestroy() {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }
  }

  initDefaultPeriod() {
    const now = new Date();
    let defYear = now.getFullYear();
    let defMonth = now.getMonth(); // 0 is January; in September, getMonth() is 8 (August in 1-indexed)
    if (defMonth === 0) {
      defMonth = 12;
      defYear -= 1;
    }
    this.selectedYear.set(defYear);
    this.selectedMonth.set(defMonth);
    this.availableYears.set([defYear]);
  }

  loadReport() {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }

    this.currentPage.set(1);
    this.hoveredBarIndex.set(null);
    this.isLoading.set(true);
    this.loadingTimeout = setTimeout(() => {
      if (this.isLoading()) {
        this.showSpinner.set(true);
      }
    }, SPINNER_DELAY_MS);

    this.errorMsg.set('');

    this.api.getHistoryReport(this.selectedYear(), this.selectedMonth()).subscribe({
      next: (data) => {
        if (this.loadingTimeout) {
          clearTimeout(this.loadingTimeout);
          this.loadingTimeout = null;
        }
        this.reportData.set(data);
        if (data.available_periods) {
          this.availablePeriods.set(data.available_periods);
        } else {
          const current = { ...this.availablePeriods() };
          current[this.selectedYear()] = data.available_months || [];
          this.availablePeriods.set(current);
        }
        if (data.available_years && data.available_years.length > 0) {
          this.availableYears.set(data.available_years);
        } else if (!this.availableYears().includes(this.selectedYear())) {
          this.availableYears.set([this.selectedYear()]);
        }
        const availMonths = data.available_months || [];
        this.availableMonths.set(availMonths);

        // Si el mes seleccionado actualmente no tiene gastos en este año, buscar el último disponible
        const currMonth = this.selectedMonth();
        if (currMonth !== null && availMonths.length > 0 && !availMonths.includes(currMonth)) {
          const fallbackMonth = availMonths[availMonths.length - 1];
          this.selectedMonth.set(fallbackMonth);
          this.loadReport();
          return;
        }

        this.hasLoadedOnce.set(true);
        this.isLoading.set(false);
        this.showSpinner.set(false);
      },
      error: (err) => {
        if (this.loadingTimeout) {
          clearTimeout(this.loadingTimeout);
          this.loadingTimeout = null;
        }
        console.error('Error cargando histórico:', err);
        this.errorMsg.set('No se pudo cargar el reporte histórico.');
        this.hasLoadedOnce.set(true);
        this.isLoading.set(false);
        this.showSpinner.set(false);
      }
    });
  }

  setYear(year: number) {
    if (this.selectedYear() === year) return;
    this.selectedYear.set(year);
    this.categoryFilter.set(null);
    this.dateFilter.set('');
    this.hoveredBarIndex.set(null);

    const periods = this.availablePeriods();
    const monthsForYear = periods[year];
    if (this.selectedMonth() !== null && monthsForYear && monthsForYear.length > 0) {
      if (!monthsForYear.includes(this.selectedMonth()!)) {
        this.selectedMonth.set(monthsForYear[monthsForYear.length - 1]);
      }
    }

    this.loadReport();
  }

  setMonth(month: number | null) {
    if (month !== null && !this.isMonthAvailable(month)) return;
    if (month === null && this.availableMonths().length === 0) return;
    if (this.selectedMonth() === month) return;
    this.selectedMonth.set(month);
    this.categoryFilter.set(null);
    this.dateFilter.set('');
    this.hoveredBarIndex.set(null);
    this.loadReport();
  }

  getAllMonthlyPeriods(): { year: number; month: number }[] {
    const periods = this.availablePeriods();
    const result: { year: number; month: number }[] = [];
    const years = Object.keys(periods).map(Number).sort((a, b) => a - b);
    for (const y of years) {
      const months = (periods[y] || []).slice().sort((a, b) => a - b);
      for (const m of months) {
        result.push({ year: y, month: m });
      }
    }
    if (result.length === 0 && this.availableMonths().length > 0) {
      for (const m of this.availableMonths()) {
        result.push({ year: this.selectedYear(), month: m });
      }
    }
    return result;
  }

  canGoPrev(): boolean {
    if (this.selectedMonth() === null) {
      return this.availableYears().some(y => y < this.selectedYear());
    }
    const all = this.getAllMonthlyPeriods();
    const currIdx = all.findIndex(p => p.year === this.selectedYear() && p.month === this.selectedMonth());
    if (currIdx > 0) return true;
    if (currIdx === 0) {
      return this.availableYears().some(y => y < this.selectedYear());
    }
    return false;
  }

  canGoNext(): boolean {
    if (this.selectedMonth() === null) {
      return this.availableYears().some(y => y > this.selectedYear());
    }
    const all = this.getAllMonthlyPeriods();
    const currIdx = all.findIndex(p => p.year === this.selectedYear() && p.month === this.selectedMonth());
    if (currIdx >= 0 && currIdx < all.length - 1) return true;
    if (currIdx === all.length - 1) {
      return this.availableYears().some(y => y > this.selectedYear());
    }
    return false;
  }

  prevPeriod() {
    if (!this.canGoPrev()) return;
    if (this.selectedMonth() === null) {
      const prevYears = this.availableYears().filter(y => y < this.selectedYear());
      if (prevYears.length > 0) {
        this.setYear(prevYears[prevYears.length - 1]);
      }
    } else {
      const all = this.getAllMonthlyPeriods();
      const currIdx = all.findIndex(p => p.year === this.selectedYear() && p.month === this.selectedMonth());
      if (currIdx > 0) {
        const prev = all[currIdx - 1];
        if (prev.year !== this.selectedYear()) {
          this.selectedYear.set(prev.year);
        }
        this.selectedMonth.set(prev.month);
        this.categoryFilter.set(null);
        this.dateFilter.set('');
        this.hoveredBarIndex.set(null);
        this.loadReport();
      } else {
        const prevYears = this.availableYears().filter(y => y < this.selectedYear());
        if (prevYears.length > 0) {
          const prevYear = prevYears[prevYears.length - 1];
          this.selectedYear.set(prevYear);
          const periods = this.availablePeriods();
          const monthsForYear = periods[prevYear];
          this.selectedMonth.set(monthsForYear && monthsForYear.length > 0 ? monthsForYear[monthsForYear.length - 1] : 12);
          this.categoryFilter.set(null);
          this.dateFilter.set('');
          this.hoveredBarIndex.set(null);
          this.loadReport();
        }
      }
    }
  }

  nextPeriod() {
    if (!this.canGoNext()) return;
    if (this.selectedMonth() === null) {
      const nextYears = this.availableYears().filter(y => y > this.selectedYear());
      if (nextYears.length > 0) {
        this.setYear(nextYears[0]);
      }
    } else {
      const all = this.getAllMonthlyPeriods();
      const currIdx = all.findIndex(p => p.year === this.selectedYear() && p.month === this.selectedMonth());
      if (currIdx >= 0 && currIdx < all.length - 1) {
        const next = all[currIdx + 1];
        if (next.year !== this.selectedYear()) {
          this.selectedYear.set(next.year);
        }
        this.selectedMonth.set(next.month);
        this.categoryFilter.set(null);
        this.dateFilter.set('');
        this.hoveredBarIndex.set(null);
        this.loadReport();
      } else {
        const nextYears = this.availableYears().filter(y => y > this.selectedYear());
        if (nextYears.length > 0) {
          const nextYear = nextYears[0];
          this.selectedYear.set(nextYear);
          const periods = this.availablePeriods();
          const monthsForYear = periods[nextYear];
          this.selectedMonth.set(monthsForYear && monthsForYear.length > 0 ? monthsForYear[0] : 1);
          this.categoryFilter.set(null);
          this.dateFilter.set('');
          this.hoveredBarIndex.set(null);
          this.loadReport();
        }
      }
    }
  }

  isMonthAvailable(m: number): boolean {
    return this.availableMonths().includes(m);
  }

  getPeriodLabel(): string {
    const data = this.reportData();
    if (data && data.period_label) return data.period_label;
    const m = this.selectedMonth();
    const y = this.selectedYear();
    return m !== null ? `${this.monthFullNames[m - 1]} ${y}` : `Año ${y}`;
  }

  getTopCategory(): any | null {
    const cats = this.reportData()?.by_category;
    if (cats && cats.length > 0) {
      return cats[0];
    }
    return null;
  }

  getHoveredBar(): any | null {
    const idx = this.hoveredBarIndex();
    if (idx === null) return null;
    const list = this.getTimelineData();
    const item = list[idx] || null;
    return item && item.amount > 0 ? item : null;
  }

  getTimelineData(): { label: string; fullLabel: string; amount: number; heightPct: number; count: number; dateKey: string }[] {
    const data = this.reportData();
    if (!data || !data.timeline) return [];

    const timeline = data.timeline;
    let maxAmount = 0;
    for (const item of timeline) {
      if (item.amount > maxAmount) maxAmount = item.amount;
    }

    const m = this.selectedMonth();
    const isMonth = m !== null;
    const y = this.selectedYear();

    return timeline.map((item: any) => {
      const hPct = maxAmount > 0 ? Math.max(4, Math.round((item.amount / maxAmount) * 100)) : 4;
      const fullLabel = isMonth
        ? `${item.day || item.label} de ${this.monthFullNames[m - 1]}`
        : `${this.monthFullNames[(item.month || 1) - 1]} ${y}`;

      const dateKey = isMonth
        ? `${y}-${String(m).padStart(2, '0')}-${String(item.day || item.label).padStart(2, '0')}`
        : `${y}-${String(item.month || 1).padStart(2, '0')}`;

      return {
        label: item.label,
        fullLabel: fullLabel,
        amount: item.amount,
        heightPct: item.amount > 0 ? hPct : 4,
        count: item.count || 0,
        dateKey: dateKey
      };
    });
  }

  filteredTransactions = computed(() => {
    const data = this.reportData();
    if (!data || !data.transactions) return [];

    let list = data.transactions as any[];
    const catId = this.categoryFilter();
    const search = this.searchQuery().trim().toLowerCase();
    const date = this.dateFilter();

    if (date) {
      list = list.filter(t => t.transaction_date && t.transaction_date.startsWith(date));
    }

    if (catId !== null) {
      list = list.filter(t => (t.category_id || 0) === catId);
    }

    if (search) {
      list = list.filter(t =>
        (t.description && t.description.toLowerCase().includes(search)) ||
        (t.category_name && t.category_name.toLowerCase().includes(search)) ||
        (t.account_name && t.account_name.toLowerCase().includes(search))
      );
    }

    const col = this.sortColumn();
    const dir = this.sortDirection();
    const result = [...list];

    if (!col || !dir) {
      return result;
    }

    const mult = dir === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      let diff = 0;
      switch (col) {
        case 'date': {
          const sA = a.transaction_date || '';
          const sB = b.transaction_date || '';
          diff = sA.localeCompare(sB);
          break;
        }
        case 'description': {
          const sA = (a.description || '').trim();
          const sB = (b.description || '').trim();
          diff = sA.localeCompare(sB, 'es', { sensitivity: 'base' });
          break;
        }
        case 'category': {
          const sA = (a.category_name || '').trim();
          const sB = (b.category_name || '').trim();
          diff = sA.localeCompare(sB, 'es', { sensitivity: 'base' });
          break;
        }
        case 'account': {
          const sA = (a.account_name || '').trim();
          const sB = (b.account_name || '').trim();
          diff = sA.localeCompare(sB, 'es', { sensitivity: 'base' });
          break;
        }
        case 'installments': {
          diff = (a.installments_count || 1) - (b.installments_count || 1);
          break;
        }
        case 'amount': {
          diff = (a.amount || 0) - (b.amount || 0);
          break;
        }
      }

      if (diff !== 0) {
        return diff * mult;
      }
      return 0;
    });

    return result;
  });

  totalItems = computed(() => this.filteredTransactions().length);

  totalPages = computed(() => {
    const total = this.totalItems();
    const size = this.pageSize();
    return total > 0 ? Math.ceil(total / size) : 1;
  });

  paginatedTransactions = computed(() => {
    const list = this.filteredTransactions();
    const total = list.length;
    const size = this.pageSize();
    const maxPages = total > 0 ? Math.ceil(total / size) : 1;
    const page = Math.min(Math.max(1, this.currentPage()), maxPages);
    const startIndex = (page - 1) * size;
    return list.slice(startIndex, startIndex + size);
  });

  setSort(col: SortColumn) {
    if (this.sortColumn() === col) {
      const initialDir: SortDirection = (col === 'date' || col === 'amount') ? 'desc' : 'asc';
      if (this.sortDirection() === initialDir) {
        // Segundo click: invertir dirección
        this.sortDirection.set(initialDir === 'desc' ? 'asc' : 'desc');
      } else {
        // Tercer click: quitar todo el ordenamiento
        this.sortColumn.set(null);
        this.sortDirection.set(null);
      }
    } else {
      // Primer click: activar orden con dirección inicial
      this.sortColumn.set(col);
      this.sortDirection.set(col === 'date' || col === 'amount' ? 'desc' : 'asc');
    }
    this.currentPage.set(1);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }
    this.currentPage.set(page);
  }

  toggleCategoryFilter(catId: number) {
    if (this.categoryFilter() === catId) {
      this.categoryFilter.set(null);
    } else {
      this.categoryFilter.set(catId);
    }
    this.currentPage.set(1);
  }

  clearCategoryFilter() {
    this.categoryFilter.set(null);
    this.currentPage.set(1);
  }

  getCategoryFilterName(): string {
    const catId = this.categoryFilter();
    if (catId === null) return '';
    const cat = this.reportData()?.by_category?.find((c: any) => c.id === catId);
    return cat ? cat.name : 'Categoría seleccionada';
  }

  getTimelineAverageText(): string {
    const report = this.reportData();
    if (!report) return '';
    const isMonth = this.selectedMonth() !== null;
    const avg = isMonth ? report.average_per_day : report.average_per_month;
    const formatted = Math.round(avg || 0).toLocaleString('es-AR');
    return `$${formatted}/${isMonth ? 'día' : 'mes'}`;
  }

  getTimelineAverageTooltip(): string {
    const isMonth = this.selectedMonth() !== null;
    return isMonth ? 'Promedio diario en el mes' : 'Promedio mensual en el año';
  }

  toggleDateFilter(dateKey: string) {
    if (this.dateFilter() === dateKey) {
      this.dateFilter.set('');
    } else {
      this.dateFilter.set(dateKey);
    }
    this.currentPage.set(1);
  }

  onDateFilterChange(val: string) {
    this.dateFilter.set(val || '');
    this.currentPage.set(1);
  }

  clearDateFilter() {
    this.dateFilter.set('');
    this.currentPage.set(1);
  }

  clearAllFilters() {
    this.categoryFilter.set(null);
    this.searchQuery.set('');
    this.dateFilter.set('');
    this.currentPage.set(1);
  }

  getMinDate(): string {
    const y = this.selectedYear();
    const m = this.selectedMonth();
    if (m !== null) {
      const mm = String(m).padStart(2, '0');
      return `${y}-${mm}-01`;
    }
    return `${y}-01`;
  }

  getMaxDate(): string {
    const y = this.selectedYear();
    const m = this.selectedMonth();
    if (m !== null) {
      const mm = String(m).padStart(2, '0');
      const lastDay = new Date(y, m, 0).getDate();
      return `${y}-${mm}-${String(lastDay).padStart(2, '0')}`;
    }
    return `${y}-12`;
  }

  getFormattedDateFilterLabel(): string {
    const d = this.dateFilter();
    if (!d) return '';
    const parts = d.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    if (parts.length === 2) {
      const mIdx = parseInt(parts[1], 10) - 1;
      const mName = this.monthFullNames[mIdx] || parts[1];
      return `${mName} ${parts[0]}`;
    }
    return d;
  }
}
