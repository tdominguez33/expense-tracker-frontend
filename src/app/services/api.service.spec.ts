import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApiService } from './api.service';

describe('ApiService Caching & Request Deduplication', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ApiService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should deduplicate and cache getCategories() calls until invalidated', () => {
    let result1: any;
    let result2: any;

    service.getCategories().subscribe(res => (result1 = res));
    service.getCategories().subscribe(res => (result2 = res));

    const reqs = httpMock.match(req => req.url.endsWith('/categories/'));
    expect(reqs.length).toBe(1);
    reqs[0].flush([{ id: 1, name: 'Comida' }]);

    expect(result1).toEqual([{ id: 1, name: 'Comida' }]);
    expect(result2).toEqual([{ id: 1, name: 'Comida' }]);

    // Subsequent call within TTL uses cache without making a new HTTP request
    let result3: any;
    service.getCategories().subscribe(res => (result3 = res));
    httpMock.expectNone(req => req.url.endsWith('/categories/'));
    expect(result3).toEqual([{ id: 1, name: 'Comida' }]);
  });

  it('should invalidate categories cache when createCategory is called', () => {
    service.getCategories().subscribe();
    httpMock.expectOne(req => req.url.endsWith('/categories/') && req.method === 'GET').flush([{ id: 1, name: 'Comida' }]);

    service.createCategory({ name: 'Salud', color: '#00ff00' }).subscribe();
    httpMock.expectOne(req => req.url.endsWith('/categories/') && req.method === 'POST').flush({ id: 2, name: 'Salud' });

    // Next getCategories() should trigger a fresh GET request
    service.getCategories().subscribe();
    httpMock.expectOne(req => req.url.endsWith('/categories/') && req.method === 'GET').flush([
      { id: 1, name: 'Comida' },
      { id: 2, name: 'Salud' }
    ]);
  });

  it('should bypass cache when forceRefresh is true', () => {
    service.getAccounts().subscribe();
    httpMock.expectOne(req => req.url.endsWith('/accounts/')).flush([{ id: 10, name: 'Visa' }]);

    service.getAccounts(true).subscribe();
    httpMock.expectOne(req => req.url.endsWith('/accounts/')).flush([{ id: 10, name: 'Visa' }]);
  });
});
