import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Dashboard } from './dashboard';
import { ApiService } from '../../services/api.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;
  let mockApiService: any;

  beforeEach(async () => {
    mockApiService = {
      getEntities: vi.fn().mockReturnValue(of([])),
      getCategories: vi.fn().mockReturnValue(of([])),
      getAccounts: vi.fn().mockReturnValue(of([])),
      getGeneralReport: vi.fn().mockReturnValue(of({ totals: {}, comparisons: {} })),
      getCreditAllReport: vi.fn().mockReturnValue(of({ total_global_debt: 0, total_available_limit: 0 })),
      getCreditReport: vi.fn().mockReturnValue(of({}))
    };

    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        { provide: ApiService, useValue: mockApiService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
