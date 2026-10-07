import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RefreshService } from './refresh.service';

describe('RefreshService', () => {
  let service: RefreshService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RefreshService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should execute registered Promise handler on triggerRefresh', async () => {
    let called = false;
    const unregister = service.register(async () => {
      called = true;
    });

    await service.triggerRefresh();
    expect(called).toBe(true);

    unregister();
    called = false;
    await service.triggerRefresh();
    expect(called).toBe(false);
  });

  it('should execute registered Observable handler on triggerRefresh', async () => {
    let called = false;
    const unregister = service.register(() => {
      called = true;
      return of({ ok: true });
    });

    await service.triggerRefresh();
    expect(called).toBe(true);

    unregister();
  });

  it('should handle unregister cleanly when multiple handlers register', async () => {
    let callCountA = 0;
    let callCountB = 0;

    const unregA = service.register(() => { callCountA++; });
    const unregB = service.register(() => { callCountB++; });

    await service.triggerRefresh();
    expect(callCountA).toBe(0);
    expect(callCountB).toBe(1);

    unregB();
    await service.triggerRefresh();
    expect(callCountB).toBe(1);
  });
});
