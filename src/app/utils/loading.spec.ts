import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { debouncedLoading } from './loading';

describe('debouncedLoading', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should not show spinner if loading completes faster than delay', () => {
    vi.useFakeTimers();
    try {
      TestBed.runInInjectionContext(() => {
        const isLoading = signal(true);
        const showSpinner = debouncedLoading(isLoading, 300);
        TestBed.flushEffects();

        expect(showSpinner()).toBe(false);

        vi.advanceTimersByTime(200);
        TestBed.flushEffects();
        expect(showSpinner()).toBe(false);

        isLoading.set(false);
        TestBed.flushEffects();

        vi.advanceTimersByTime(200);
        TestBed.flushEffects();
        expect(showSpinner()).toBe(false);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('should show spinner if loading takes longer than delay and hide when done', () => {
    vi.useFakeTimers();
    try {
      TestBed.runInInjectionContext(() => {
        const isLoading = signal(true);
        const showSpinner = debouncedLoading(isLoading, 300);
        TestBed.flushEffects();

        expect(showSpinner()).toBe(false);

        vi.advanceTimersByTime(300);
        TestBed.flushEffects();
        expect(showSpinner()).toBe(true);

        isLoading.set(false);
        TestBed.flushEffects();
        expect(showSpinner()).toBe(false);
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
