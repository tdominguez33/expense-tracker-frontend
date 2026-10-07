import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { Layout } from './layout';
import { RefreshService } from '../services/refresh.service';

describe('Layout', () => {
  let component: Layout;
  let fixture: ComponentFixture<Layout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Layout],
      providers: [provideRouter([]), provideHttpClient()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Layout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the app icon next to the title in the navbar', () => {
    const navbarImg = fixture.nativeElement.querySelector('.navbar img[alt="Logo"]') as HTMLImageElement;
    expect(navbarImg).toBeTruthy();
    expect(navbarImg.getAttribute('src')).toBe('icon.png');
  });

  it('should default to dark theme when no stored theme is found', () => {
    if (typeof localStorage !== 'undefined' && typeof localStorage?.removeItem === 'function') {
      localStorage.removeItem('theme');
    }
    const newFixture = TestBed.createComponent(Layout);
    const newComponent = newFixture.componentInstance;
    expect(newComponent.isDarkTheme).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('should toggle theme and update meta theme-color tag', () => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }

    component.isDarkTheme = true;
    component.toggleTheme(); // switches to false (corporate/light)
    expect(component.isDarkTheme).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('corporate');
    expect(meta.getAttribute('content')).toBe('#f2f2f2');

    component.toggleTheme(); // switches back to true (dark)
    expect(component.isDarkTheme).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(meta.getAttribute('content')).toBe('#191e24');
  });

  it('should invoke document.startViewTransition when available', () => {
    const startViewTransitionMock = vi.fn((cb: () => void) => {
      cb();
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve()
      };
    });

    (document as any).startViewTransition = startViewTransitionMock;

    try {
      component.isDarkTheme = true;
      component.toggleTheme();
      expect(startViewTransitionMock).toHaveBeenCalled();
      expect(component.isDarkTheme).toBe(false);
      expect(document.documentElement.getAttribute('data-theme')).toBe('corporate');
    } finally {
      delete (document as any).startViewTransition;
    }
  });

  it('should render theme toggle button with .theme-toggle-btn', () => {
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button.theme-toggle-btn') as HTMLButtonElement;
    expect(btn).toBeTruthy();
  });

  it('should open drawer on edge swipe right and close on swipe left', () => {
    // Set viewport width to mobile (< 1024)
    vi.stubGlobal('innerWidth', 375);

    const drawer = fixture.nativeElement.querySelector('#my-drawer-2') as HTMLInputElement;
    expect(drawer.checked).toBe(false);

    // 1. Edge swipe starting at clientX = 20, moving to 120
    const preventDefaultMock = vi.fn();
    component.onGlobalTouchStart({
      touches: [{ clientX: 20, clientY: 200 }],
      cancelable: true,
      preventDefault: preventDefaultMock
    } as any);

    expect(preventDefaultMock).toHaveBeenCalled();

    component.onGlobalTouchMove({
      touches: [{ clientX: 80, clientY: 205 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    component.onGlobalTouchEnd({
      touches: []
    } as any);

    // Wait, onGlobalTouchEnd checks currentTouchX which was updated in touchmove to 80
    // deltaX = 80 - 20 = 60 (> 40)
    expect(drawer.checked).toBe(true);

    // 2. Swipe left to close drawer
    component.onGlobalTouchStart({
      touches: [{ clientX: 200, clientY: 200 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    component.onGlobalTouchMove({
      touches: [{ clientX: 100, clientY: 200 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    component.onGlobalTouchEnd({
      touches: []
    } as any);

    expect(drawer.checked).toBe(false);

    // 3. Swipe starting in middle of screen (clientX = 150) should NOT open drawer
    component.onGlobalTouchStart({
      touches: [{ clientX: 150, clientY: 200 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    component.onGlobalTouchMove({
      touches: [{ clientX: 250, clientY: 200 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    component.onGlobalTouchEnd({
      touches: []
    } as any);

    expect(drawer.checked).toBe(false);

    vi.unstubAllGlobals();
  });

  it('should progressively move sidebar panel and update overlay during edge touch drag to open', () => {
    vi.stubGlobal('innerWidth', 375);
    const drawer = fixture.nativeElement.querySelector('#my-drawer-2') as HTMLInputElement;
    const panel = fixture.nativeElement.querySelector('.sidebar-panel') as HTMLElement;
    const overlay = fixture.nativeElement.querySelector('.drawer-overlay') as HTMLElement;

    drawer.checked = false;

    // Start edge swipe at clientX = 20
    component.onGlobalTouchStart({
      touches: [{ clientX: 20, clientY: 200 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    // Drag to clientX = 120 (dx = 100)
    component.onGlobalTouchMove({
      touches: [{ clientX: 120, clientY: 200 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    // Panel should have inline transform tracking the finger (panelWidth = 288, translateX = -288 + 100 = -188px)
    expect(panel.style.transform).toBe('translateX(-188px)');
    expect(panel.style.transition).toBe('none');
    expect(overlay.style.backgroundColor).toContain('rgba(0, 0, 0,');
    expect(overlay.style.transition).toBe('none');

    // Drag further to clientX = 220 (dx = 200)
    component.onGlobalTouchMove({
      touches: [{ clientX: 220, clientY: 200 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    expect(panel.style.transform).toBe('translateX(-88px)');

    // Release touch: since dx = 200 (> 40), it snaps open
    component.onGlobalTouchEnd({
      touches: []
    } as any);

    expect(drawer.checked).toBe(true);
    expect(panel.style.transform).toBe('translateX(0px)');
    expect(panel.style.transition).toContain('transform');

    vi.unstubAllGlobals();
  });

  it('should progressively move sidebar panel and dim overlay during drag to close', () => {
    vi.stubGlobal('innerWidth', 375);
    const drawer = fixture.nativeElement.querySelector('#my-drawer-2') as HTMLInputElement;
    const panel = fixture.nativeElement.querySelector('.sidebar-panel') as HTMLElement;
    const overlay = fixture.nativeElement.querySelector('.drawer-overlay') as HTMLElement;

    drawer.checked = true;

    // Touch inside open drawer / overlay at clientX = 250
    component.onGlobalTouchStart({
      touches: [{ clientX: 250, clientY: 200 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    // Drag left to clientX = 150 (dx = -100)
    component.onGlobalTouchMove({
      touches: [{ clientX: 150, clientY: 200 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    // Panel moves progressively with dx (-100px)
    expect(panel.style.transform).toBe('translateX(-100px)');
    expect(panel.style.transition).toBe('none');
    expect(overlay.style.backgroundColor).toContain('rgba(0, 0, 0,');

    // Release touch: since dx = -100 (< -40), it snaps closed
    component.onGlobalTouchEnd({
      touches: []
    } as any);

    expect(drawer.checked).toBe(false);
    expect(panel.style.transform).toBe('translateX(-100%)');
    expect(overlay.style.backgroundColor).toBe('transparent');

    vi.unstubAllGlobals();
  });

  it('should snap back closed if edge swipe was released before threshold', () => {
    vi.stubGlobal('innerWidth', 375);
    const drawer = fixture.nativeElement.querySelector('#my-drawer-2') as HTMLInputElement;
    const panel = fixture.nativeElement.querySelector('.sidebar-panel') as HTMLElement;
    const overlay = fixture.nativeElement.querySelector('.drawer-overlay') as HTMLElement;

    drawer.checked = false;

    // Start edge swipe at clientX = 20
    component.onGlobalTouchStart({
      touches: [{ clientX: 20, clientY: 200 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    // Drag slightly: dx = 15 (< 40 threshold)
    component.onGlobalTouchMove({
      touches: [{ clientX: 35, clientY: 200 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    expect(panel.style.transform).toBe('translateX(-273px)');

    // Release
    component.onGlobalTouchEnd({
      touches: []
    } as any);

    expect(drawer.checked).toBe(false);
    expect(panel.style.transform).toBe('translateX(-100%)');
    expect(overlay.style.backgroundColor).toBe('transparent');

    vi.unstubAllGlobals();
  });

  it('should snap back open if drag to close was released before threshold', () => {
    vi.stubGlobal('innerWidth', 375);
    const drawer = fixture.nativeElement.querySelector('#my-drawer-2') as HTMLInputElement;
    const panel = fixture.nativeElement.querySelector('.sidebar-panel') as HTMLElement;
    const overlay = fixture.nativeElement.querySelector('.drawer-overlay') as HTMLElement;

    drawer.checked = true;

    // Start drag at clientX = 200
    component.onGlobalTouchStart({
      touches: [{ clientX: 200, clientY: 200 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    // Drag slightly left: dx = -15 (> -40 threshold)
    component.onGlobalTouchMove({
      touches: [{ clientX: 185, clientY: 200 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    expect(panel.style.transform).toBe('translateX(-15px)');

    // Release
    component.onGlobalTouchEnd({
      touches: []
    } as any);

    expect(drawer.checked).toBe(true);
    expect(panel.style.transform).toBe('translateX(0px)');
    expect(overlay.style.backgroundColor).toContain('rgba(0, 0, 0,');

    vi.unstubAllGlobals();
  });

  it('should not hijack gesture when swiping vertically (e.g. scrolling menu)', () => {
    vi.stubGlobal('innerWidth', 375);
    const drawer = fixture.nativeElement.querySelector('#my-drawer-2') as HTMLInputElement;
    const panel = fixture.nativeElement.querySelector('.sidebar-panel') as HTMLElement;

    drawer.checked = true;

    component.onGlobalTouchStart({
      touches: [{ clientX: 100, clientY: 100 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    // Vertical drag: dy = 50, dx = -5
    component.onGlobalTouchMove({
      touches: [{ clientX: 95, clientY: 150 }],
      cancelable: true,
      preventDefault: vi.fn()
    } as any);

    // Should not have applied horizontal drag transform
    expect(panel.style.transform).toBe('');
    expect(component['isDrawerSwiping']).toBe(false);

    vi.unstubAllGlobals();
  });


  it('should not intercept touches or start edge swipe when touching inside the navbar or on the menu button', () => {
    vi.stubGlobal('innerWidth', 375);
    const preventDefaultMock = vi.fn();

    const navbarBtn = fixture.nativeElement.querySelector('label[for="my-drawer-2"]') as HTMLElement;
    expect(navbarBtn).toBeTruthy();

    component.onGlobalTouchStart({
      touches: [{ clientX: 20, clientY: 30 }],
      target: navbarBtn,
      cancelable: true,
      preventDefault: preventDefaultMock
    } as any);

    expect(preventDefaultMock).not.toHaveBeenCalled();
    expect(component['isEdgeSwiping']).toBe(false);

    vi.unstubAllGlobals();
  });

  it('should not intercept touches or start edge swipe when touching an interactive button near the screen edge', () => {
    vi.stubGlobal('innerWidth', 375);
    const preventDefaultMock = vi.fn();

    const button = document.createElement('button');
    button.className = 'btn btn-circle';

    component.onGlobalTouchStart({
      touches: [{ clientX: 15, clientY: 150 }],
      target: button,
      cancelable: true,
      preventDefault: preventDefaultMock
    } as any);

    expect(preventDefaultMock).not.toHaveBeenCalled();
    expect(component['isEdgeSwiping']).toBe(false);

    vi.unstubAllGlobals();
  });

  it('should toggle isSidebarCollapsed and persist to localStorage', () => {
    const storage: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val; },
      removeItem: (key: string) => { delete storage[key]; }
    });

    expect(component.isSidebarCollapsed).toBe(false);

    component.toggleSidebarCollapse();
    expect(component.isSidebarCollapsed).toBe(true);
    expect(storage['sidebar_collapsed']).toBe('true');

    component.toggleSidebarCollapse();
    expect(component.isSidebarCollapsed).toBe(false);
    expect(storage['sidebar_collapsed']).toBe('false');

    vi.unstubAllGlobals();
  });

  it('should load stored sidebar_collapsed preference from localStorage on init', () => {
    const storage: Record<string, string> = { sidebar_collapsed: 'true' };
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val; },
      removeItem: (key: string) => { delete storage[key]; }
    });

    const newFixture = TestBed.createComponent(Layout);
    const newComp = newFixture.componentInstance;
    expect(newComp.isSidebarCollapsed).toBe(true);

    vi.unstubAllGlobals();
  });

  it('should render the outer border collapse toggle button and toggle collapse when clicked', () => {
    const toggleBtn = fixture.nativeElement.querySelector('button[aria-label*="barra lateral"]') as HTMLButtonElement;
    expect(toggleBtn).toBeTruthy();
    expect(component.isSidebarCollapsed).toBe(false);

    toggleBtn.click();
    fixture.detectChanges();
    expect(component.isSidebarCollapsed).toBe(true);

    toggleBtn.click();
    fixture.detectChanges();
    expect(component.isSidebarCollapsed).toBe(false);
  });

  describe('Pull-to-refresh (Mobile view)', () => {
    let refreshService: RefreshService;

    beforeEach(() => {
      fixture.detectChanges();
      refreshService = TestBed.inject(RefreshService);
    });

    it('should translate page content down and update indicator as user pulls down', () => {
      vi.stubGlobal('innerWidth', 375);

      const mainEl = fixture.nativeElement.querySelector('main') as HTMLElement;
      expect(mainEl).toBeTruthy();
      mainEl.scrollTop = 0;

      // Start touch in main content
      component.onGlobalTouchStart({
        touches: [{ clientX: 150, clientY: 100 }],
        target: mainEl
      } as any);

      expect(component.canPullToRefresh).toBe(true);

      // Drag down 80px
      const preventDefault = vi.fn();
      component.onGlobalTouchMove({
        touches: [{ clientX: 150, clientY: 180 }],
        cancelable: true,
        preventDefault
      } as any);

      expect(component.isPullDragging()).toBe(true);
      expect(component.pullDistance()).toBeGreaterThan(0);
      expect(component.pullIndicatorY()).toBeGreaterThan(0);
      expect(preventDefault).toHaveBeenCalled();

      fixture.detectChanges();
      const contentEl = fixture.nativeElement.querySelector('.pull-refresh-content') as HTMLElement;
      expect(contentEl.style.transform).toContain('translateY');
      const indicatorEl = fixture.nativeElement.querySelector('.pull-refresh-indicator') as HTMLElement;
      expect(indicatorEl).toBeTruthy();

      vi.unstubAllGlobals();
    });

    it('should reset pull styles on touchend if threshold is not reached', () => {
      vi.stubGlobal('innerWidth', 375);

      const mainEl = fixture.nativeElement.querySelector('main') as HTMLElement;
      mainEl.scrollTop = 0;

      component.onGlobalTouchStart({
        touches: [{ clientX: 150, clientY: 100 }],
        target: mainEl
      } as any);

      // Drag slightly (15px)
      component.onGlobalTouchMove({
        touches: [{ clientX: 150, clientY: 115 }],
        cancelable: true,
        preventDefault: vi.fn()
      } as any);

      expect(component.pullDistance()).toBeLessThan(component.PULL_THRESHOLD);

      component.onGlobalTouchEnd({} as any);

      expect(component.isPullDragging()).toBe(false);
      expect(component.pullDistance()).toBe(0);
      expect(component.isRefreshing()).toBe(false);

      vi.unstubAllGlobals();
    });

    it('should trigger silent refresh and spin indicator when reaching threshold', async () => {
      vi.stubGlobal('innerWidth', 375);
      const refreshSpy = vi.spyOn(refreshService, 'triggerRefresh').mockResolvedValue();

      const mainEl = fixture.nativeElement.querySelector('main') as HTMLElement;
      mainEl.scrollTop = 0;

      component.onGlobalTouchStart({
        touches: [{ clientX: 150, clientY: 100 }],
        target: mainEl
      } as any);

      // Pull down far enough to cross threshold (e.g. 150px downwards)
      component.onGlobalTouchMove({
        touches: [{ clientX: 150, clientY: 250 }],
        cancelable: true,
        preventDefault: vi.fn()
      } as any);

      expect(component.pullDistance()).toBeGreaterThanOrEqual(component.PULL_THRESHOLD);

      fixture.detectChanges();
      const spinnerSvg = fixture.nativeElement.querySelector('.pull-refresh-indicator svg');
      // While dragging (even past threshold), it should NOT spin yet
      expect(spinnerSvg?.classList.contains('animate-spin')).toBe(false);

      const refreshPromise = component.onGlobalTouchEnd({} as any);

      // Once released, isRefreshing becomes true and it starts spinning
      fixture.detectChanges();
      expect(component.isRefreshing()).toBe(true);
      expect(spinnerSvg?.classList.contains('animate-spin')).toBe(true);
      expect(component.pullDistance()).toBe(55);

      await refreshPromise;
      expect(refreshSpy).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('should NOT activate pull-to-refresh when desktop (innerWidth >= 1024)', () => {
      vi.stubGlobal('innerWidth', 1280);

      const mainEl = fixture.nativeElement.querySelector('main') as HTMLElement;
      mainEl.scrollTop = 0;

      component.onGlobalTouchStart({
        touches: [{ clientX: 300, clientY: 100 }],
        target: mainEl
      } as any);

      expect(component.canPullToRefresh).toBe(false);

      vi.unstubAllGlobals();
    });

    it('should NOT activate pull-to-refresh when main.scrollTop > 0', () => {
      vi.stubGlobal('innerWidth', 375);

      const mainEl = fixture.nativeElement.querySelector('main') as HTMLElement;
      mainEl.scrollTop = 50;

      component.onGlobalTouchStart({
        touches: [{ clientX: 150, clientY: 100 }],
        target: mainEl
      } as any);

      expect(component.canPullToRefresh).toBe(false);

      vi.unstubAllGlobals();
    });

    it('should NOT activate pull-to-refresh when starting at edge (drawer swipe takes precedence)', () => {
      vi.stubGlobal('innerWidth', 375);

      const mainEl = fixture.nativeElement.querySelector('main') as HTMLElement;
      mainEl.scrollTop = 0;

      component.onGlobalTouchStart({
        touches: [{ clientX: 20, clientY: 150 }],
        target: mainEl
      } as any);

      expect(component.canPullToRefresh).toBe(false);
      expect(component.pullDistance()).toBe(0);

      vi.unstubAllGlobals();
    });
  });
});
