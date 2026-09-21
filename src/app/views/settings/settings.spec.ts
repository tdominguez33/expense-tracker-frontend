import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Settings } from './settings';
import { ApiService } from '../../services/api.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Settings', () => {
  let component: Settings;
  let fixture: ComponentFixture<Settings>;
  let mockApiService: any;

  beforeEach(async () => {
    mockApiService = {
      getConfig: vi.fn().mockReturnValue(of({ default_tax_percentage: 0, default_account_id: null, timezone: 'America/Argentina/Buenos_Aires', statement_grace_days: 10 })),
      getCategories: vi.fn().mockReturnValue(of([])),
      getEntities: vi.fn().mockReturnValue(of([])),
      getAccounts: vi.fn().mockReturnValue(of([]))
    };

    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        { provide: ApiService, useValue: mockApiService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should step grace days correctly', () => {
    component.configForm.patchValue({ statement_grace_days: 10 });
    component.stepGraceDays(1);
    expect(component.configForm.get('statement_grace_days')?.value).toBe(11);
    component.stepGraceDays(-5);
    expect(component.configForm.get('statement_grace_days')?.value).toBe(6);
    component.stepGraceDays(-10);
    expect(component.configForm.get('statement_grace_days')?.value).toBe(0);
  });

  it('should step tax percentage correctly', () => {
    component.configForm.patchValue({ default_tax_percentage: '0' });
    component.stepTaxConfig(0.1);
    expect(component.configForm.get('default_tax_percentage')?.value).toBe('0,1');
    component.stepTaxConfig(-0.1);
    expect(component.configForm.get('default_tax_percentage')?.value).toBe('0');
  });
});
