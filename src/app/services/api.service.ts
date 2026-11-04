import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse, HttpParams } from '@angular/common/http';
import { ConfigService } from './config.service';
import { Observable, shareReplay, tap, catchError, throwError } from 'rxjs';

interface CacheEntry<T> {
  obs$: Observable<T>;
  expiresAt: number;
  baseUrl: string;
}

const DEFAULT_CACHE_TTL_MS = 60_000;

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  private cache = new Map<string, CacheEntry<any>>();

  private get baseUrl() {
    return this.config.apiUrl();
  }

  private getCached<T>(key: string, factory: () => Observable<T>, ttlMs = DEFAULT_CACHE_TTL_MS): Observable<T> {
    const now = Date.now();
    const currentBaseUrl = this.baseUrl;
    const existing = this.cache.get(key);
    if (existing && existing.baseUrl === currentBaseUrl && existing.expiresAt > now) {
      return existing.obs$;
    }

    const obs$ = factory().pipe(
      catchError((err) => {
        this.cache.delete(key);
        return throwError(() => err);
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.cache.set(key, {
      obs$,
      expiresAt: now + ttlMs,
      baseUrl: currentBaseUrl
    });

    return obs$;
  }

  invalidateCache(...keys: string[]): void {
    if (keys.length === 0) {
      this.cache.clear();
      return;
    }
    for (const k of keys) {
      this.cache.delete(k);
    }
  }

  // --- CONFIG ---
  getConfig(forceRefresh = false): Observable<any> {
    if (forceRefresh) this.invalidateCache('config');
    return this.getCached('config', () => this.http.get(`${this.baseUrl}/config/`));
  }

  updateConfig(data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/config/`, data).pipe(
      tap(() => this.invalidateCache('config'))
    );
  }

  // --- CATEGORIES ---
  getCategories(forceRefresh = false): Observable<any> {
    if (forceRefresh) this.invalidateCache('categories');
    return this.getCached('categories', () => this.http.get(`${this.baseUrl}/categories/`));
  }

  createCategory(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/categories/`, data).pipe(
      tap(() => this.invalidateCache('categories'))
    );
  }

  updateCategory(id: number, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/categories/${id}`, data).pipe(
      tap(() => this.invalidateCache('categories'))
    );
  }

  reorderCategories(orders: { id: number; sort_order: number }[]): Observable<any> {
    return this.http.put(`${this.baseUrl}/categories/reorder`, orders).pipe(
      tap(() => this.invalidateCache('categories'))
    );
  }

  deleteCategory(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/categories/${id}`).pipe(
      tap(() => this.invalidateCache('categories'))
    );
  }

  // --- ACCOUNTS ---
  getAccounts(forceRefresh = false): Observable<any> {
    if (forceRefresh) this.invalidateCache('accounts');
    return this.getCached('accounts', () => this.http.get(`${this.baseUrl}/accounts/`));
  }

  createAccount(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/accounts/`, data).pipe(
      tap(() => this.invalidateCache('accounts'))
    );
  }

  updateAccount(id: number, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/accounts/${id}`, data).pipe(
      tap(() => this.invalidateCache('accounts'))
    );
  }

  reorderAccounts(orders: { id: number; sort_order: number }[]): Observable<any> {
    return this.http.put(`${this.baseUrl}/accounts/reorder`, orders).pipe(
      tap(() => this.invalidateCache('accounts'))
    );
  }

  deleteAccount(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/accounts/${id}`).pipe(
      tap(() => this.invalidateCache('accounts', 'config'))
    );
  }

  // --- ENTITIES ---
  getEntities(forceRefresh = false): Observable<any> {
    if (forceRefresh) this.invalidateCache('entities');
    return this.getCached('entities', () => this.http.get(`${this.baseUrl}/entities/`));
  }

  createEntity(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/entities/`, data).pipe(
      tap(() => this.invalidateCache('entities'))
    );
  }

  updateEntity(id: number, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/entities/${id}`, data).pipe(
      tap(() => this.invalidateCache('entities'))
    );
  }

  reorderEntities(orders: { id: number; sort_order: number }[]): Observable<any> {
    return this.http.put(`${this.baseUrl}/entities/reorder`, orders).pipe(
      tap(() => this.invalidateCache('entities'))
    );
  }

  deleteEntity(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/entities/${id}`).pipe(
      tap(() => this.invalidateCache('entities', 'accounts'))
    );
  }

  // --- TRANSACTIONS ---
  getTransactions(params?: { page?: number; limit?: number; search?: string; category_id?: number | 'all' }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.page !== undefined) {
        httpParams = httpParams.set('page', params.page.toString());
      }
      if (params.limit !== undefined) {
        httpParams = httpParams.set('limit', params.limit.toString());
      }
      if (params.search && params.search.trim()) {
        httpParams = httpParams.set('search', params.search.trim());
      }
      if (params.category_id !== undefined && params.category_id !== 'all') {
        httpParams = httpParams.set('category_id', params.category_id.toString());
      }
    }
    return this.http.get(`${this.baseUrl}/transactions/`, { params: httpParams });
  }

  createTransaction(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/transactions/`, data);
  }

  updateTransaction(id: number, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/transactions/${id}`, data);
  }

  deleteTransaction(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/transactions/${id}`);
  }

  postponeTransaction(id: number, postpone: boolean): Observable<any> {
    return this.http.post(`${this.baseUrl}/transactions/${id}/postpone?postpone=${postpone}`, {});
  }

  // --- STATEMENTS ---
  getStatements(): Observable<any> {
    return this.http.get(`${this.baseUrl}/statements/`);
  }

  createStatement(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/statements/`, data);
  }

  updateStatement(id: number, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/statements/${id}`, data);
  }

  deleteStatement(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/statements/${id}`);
  }

  getStatementItems(statementId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/statements/${statementId}/items`);
  }

  // --- INSTALLMENTS ---
  getInstallments(): Observable<any> {
    return this.http.get(`${this.baseUrl}/installments/`);
  }

  // --- REPORTS ---
  getGeneralReport(): Observable<any> {
    return this.http.get(`${this.baseUrl}/reports/general`);
  }

  getCreditAllReport(): Observable<any> {
    return this.http.get(`${this.baseUrl}/reports/credit/all`);
  }

  getCreditReport(accountId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/reports/credit/${accountId}`);
  }

  getDebitReport(accountId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/reports/debit/${accountId}`);
  }

  getHistoryReport(year: number, month?: number | null): Observable<any> {
    let params = new HttpParams().set('year', year.toString());
    if (month !== undefined && month !== null) {
      params = params.set('month', month.toString());
    }
    return this.http.get(`${this.baseUrl}/reports/history`, { params });
  }

  // --- DATABASE ---
  backupDatabase(): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.baseUrl}/database/backup`, {
      responseType: 'blob',
      observe: 'response'
    });
  }

  restoreDatabase(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post(`${this.baseUrl}/database/restore`, formData).pipe(
      tap(() => this.invalidateCache())
    );
  }
}
