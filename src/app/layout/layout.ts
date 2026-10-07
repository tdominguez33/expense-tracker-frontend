import { Component, inject, OnInit, OnDestroy, ElementRef, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class Layout implements OnInit, OnDestroy {
  isDarkTheme = true;
  isSidebarCollapsed = false;
  private router = inject(Router);
  private elementRef = inject(ElementRef);

  private edgeTouchStartX = 0;
  private edgeTouchStartY = 0;
  private currentTouchX = 0;
  private currentTouchY = 0;
  private touchStartTime = 0;
  private isEdgeSwiping = false;
  private isDrawerSwiping = false;
  private isDragging = false;
  private isDirectionLocked = false;
  private dragAnimationTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private authService: AuthService) {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed()
    ).subscribe(() => {
      this.closeDrawer();
    });
    let storedTheme: string | null = null;
    let storedSidebar: string | null = null;
    if (typeof localStorage !== 'undefined' && typeof localStorage?.getItem === 'function') {
      try {
        storedTheme = localStorage.getItem('theme');
        storedSidebar = localStorage.getItem('sidebar_collapsed');
      } catch {}
    }

    if (storedTheme) {
      this.isDarkTheme = storedTheme === 'dark';
    } else {
      this.isDarkTheme = true;
    }
    if (storedSidebar !== null) {
      this.isSidebarCollapsed = storedSidebar === 'true';
    }
    this.applyTheme();
  }

  ngOnInit() {
    if (typeof window !== 'undefined') {
      window.addEventListener('touchstart', this.onGlobalTouchStart, { passive: false });
      window.addEventListener('touchmove', this.onGlobalTouchMove, { passive: false });
      window.addEventListener('touchend', this.onGlobalTouchEnd, { passive: true });
      window.addEventListener('touchcancel', this.onGlobalTouchEnd, { passive: true });
    }
  }

  ngOnDestroy() {
    this.clearDragStyles();
    if (typeof window !== 'undefined') {
      window.removeEventListener('touchstart', this.onGlobalTouchStart);
      window.removeEventListener('touchmove', this.onGlobalTouchMove);
      window.removeEventListener('touchend', this.onGlobalTouchEnd);
      window.removeEventListener('touchcancel', this.onGlobalTouchEnd);
    }
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      this.clearDragStyles();
    }
  }

  onDrawerChange() {
    this.clearDragStyles();
  }

  onGlobalTouchStart = (e: TouchEvent) => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) return;
    if (e.touches.length !== 1) return;

    this.clearDragStyles();

    const touch = e.touches[0];
    this.edgeTouchStartX = touch.clientX;
    this.edgeTouchStartY = touch.clientY;
    this.currentTouchX = touch.clientX;
    this.currentTouchY = touch.clientY;
    this.touchStartTime = Date.now();
    this.isDragging = false;
    this.isDirectionLocked = false;

    if (!this.isDrawerOpen()) {
      // Exclude top navbar area to allow tapping the menu button without interference
      let isTopNavbar = false;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('.navbar, label[for="my-drawer-2"]')) {
        isTopNavbar = true;
      } else if (typeof document !== 'undefined') {
        const navbar = document.querySelector('.navbar');
        if (navbar) {
          const rect = navbar.getBoundingClientRect();
          if (rect.bottom > 0 && touch.clientY <= rect.bottom) {
            isTopNavbar = true;
          }
        }
        if (touch.clientY <= 70) {
          isTopNavbar = true;
        }
      }

      if (isTopNavbar) {
        this.isEdgeSwiping = false;
        this.isDrawerSwiping = false;
        return;
      }

      // Exclude interactive elements (buttons, links, etc.) to allow normal clicks without swipe interference
      const isInteractive = target?.closest?.('button, a, input, select, textarea, [role="button"], .btn');
      if (isInteractive) {
        this.isEdgeSwiping = false;
        this.isDrawerSwiping = false;
        return;
      }

      // Touch starts near the left edge (within 35px) below the navbar
      if (touch.clientX <= 35) {
        this.isEdgeSwiping = true;
        this.isDrawerSwiping = false;
        if (e.cancelable) {
          e.preventDefault();
        }
      } else {
        this.isEdgeSwiping = false;
        this.isDrawerSwiping = false;
      }
    } else {
      this.isDrawerSwiping = true;
      this.isEdgeSwiping = false;
    }
  };

  onGlobalTouchMove = (e: TouchEvent) => {
    if (!this.isEdgeSwiping && !this.isDrawerSwiping) return;
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    this.currentTouchX = touch.clientX;
    this.currentTouchY = touch.clientY;

    const dx = this.currentTouchX - this.edgeTouchStartX;
    const dy = this.currentTouchY - this.edgeTouchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (!this.isDirectionLocked) {
      if (Math.hypot(dx, dy) < 6) {
        return;
      }

      if (absDy > absDx) {
        // Vertical movement: cancel swipe so user can scroll naturally
        this.isDirectionLocked = true;
        this.isEdgeSwiping = false;
        this.isDrawerSwiping = false;
        this.isDragging = false;
        return;
      }

      if (this.isEdgeSwiping && dx <= 0) {
        return;
      }

      if (this.isDrawerSwiping && dx >= 0) {
        return;
      }

      this.isDirectionLocked = true;
      this.isDragging = true;
    }

    if (!this.isDragging) return;

    if (e.cancelable) {
      e.preventDefault();
    }

    const panel = this.getSidebarPanel();
    const overlay = this.getDrawerOverlay();
    const panelWidth = this.getSidebarPanelWidth();

    if (this.isEdgeSwiping) {
      const clampedDx = Math.max(0, Math.min(panelWidth, dx));
      const translateX = -panelWidth + clampedDx;
      const progress = Math.max(0, Math.min(1, clampedDx / panelWidth));

      if (panel) {
        panel.style.transition = 'none';
        panel.style.transform = `translateX(${translateX}px)`;
      }
      if (overlay) {
        overlay.style.transition = 'none';
        overlay.style.backgroundColor = `rgba(0, 0, 0, ${0.4 * progress})`;
      }
    } else if (this.isDrawerSwiping) {
      const clampedDx = Math.max(-panelWidth, Math.min(0, dx));
      const translateX = clampedDx;
      const progress = Math.max(0, Math.min(1, 1 - (Math.abs(clampedDx) / panelWidth)));

      if (panel) {
        panel.style.transition = 'none';
        panel.style.transform = `translateX(${translateX}px)`;
      }
      if (overlay) {
        overlay.style.transition = 'none';
        overlay.style.backgroundColor = `rgba(0, 0, 0, ${0.4 * progress})`;
      }
    }
  };

  onGlobalTouchEnd = (e: TouchEvent) => {
    if (!this.isEdgeSwiping && !this.isDrawerSwiping) return;

    const dx = this.currentTouchX - this.edgeTouchStartX;
    const dy = Math.abs(this.currentTouchY - this.edgeTouchStartY);
    const duration = Date.now() - this.touchStartTime;
    const velocityX = dx / Math.max(duration, 1);

    const wasEdgeSwiping = this.isEdgeSwiping;
    const wasDrawerSwiping = this.isDrawerSwiping;
    const wasDragging = this.isDragging;

    this.isEdgeSwiping = false;
    this.isDrawerSwiping = false;
    this.isDragging = false;
    this.isDirectionLocked = false;

    if (wasEdgeSwiping) {
      const isFlick = velocityX > 0.3 && dx > 30;
      const isMovedFarEnough = dx > 40 && dx > dy * 1.2;
      if (isFlick || isMovedFarEnough) {
        this.snapOpen(wasDragging);
      } else if (wasDragging) {
        this.snapClose(true);
      }
    } else if (wasDrawerSwiping) {
      const isFlick = velocityX < -0.3 && dx < -30;
      const isMovedFarEnough = dx < -40 && Math.abs(dx) > dy * 1.2;
      if (isFlick || isMovedFarEnough) {
        this.snapClose(wasDragging);
      } else if (wasDragging) {
        this.snapOpen(true);
      }
    }
  };

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;

    if (
      typeof document !== 'undefined' &&
      'startViewTransition' in document &&
      typeof (document as any).startViewTransition === 'function'
    ) {
      const style = document.createElement('style');
      style.appendChild(
        document.createTextNode(
          `*, *::before, *::after {
            -webkit-transition: none !important;
            -moz-transition: none !important;
            -o-transition: none !important;
            -ms-transition: none !important;
            transition: none !important;
          }`
        )
      );
      document.head.appendChild(style);

      const transition = (document as any).startViewTransition(() => {
        this.applyTheme();
      });

      const cleanup = () => {
        if (style.parentNode) {
          document.head.removeChild(style);
        }
      };

      if (transition && typeof transition.ready?.then === 'function') {
        transition.ready.then(cleanup, cleanup);
      } else if (transition && typeof transition.finished?.then === 'function') {
        transition.finished.then(cleanup, cleanup);
      } else {
        cleanup();
      }
    } else {
      this.applyTheme();
    }
  }

  private applyTheme() {
    const theme = this.isDarkTheme ? 'dark' : 'corporate';
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', theme);
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', this.isDarkTheme ? '#191e24' : '#f2f2f2');
      }
    }
    if (typeof localStorage !== 'undefined' && typeof localStorage?.setItem === 'function') {
      try {
        localStorage.setItem('theme', theme);
      } catch {}
    }
  }

  isDrawerOpen(): boolean {
    const drawer = this.getDrawerInput();
    return !!drawer?.checked;
  }

  openDrawer() {
    this.clearDragStyles();
    const drawer = this.getDrawerInput();
    if (drawer && !drawer.checked) {
      drawer.checked = true;
    }
  }

  closeDrawer() {
    this.clearDragStyles();
    const drawer = this.getDrawerInput();
    if (drawer && drawer.checked) {
      drawer.checked = false;
    }
  }

  private snapOpen(wasDragging: boolean) {
    const drawer = this.getDrawerInput();
    if (drawer && !drawer.checked) {
      drawer.checked = true;
    }

    const panel = this.getSidebarPanel();
    const overlay = this.getDrawerOverlay();

    if (wasDragging && panel && overlay) {
      panel.style.transition = 'transform 240ms cubic-bezier(0.32, 0.72, 0, 1)';
      panel.style.transform = 'translateX(0px)';
      overlay.style.transition = 'background-color 240ms cubic-bezier(0.32, 0.72, 0, 1)';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';

      this.clearDragTimeout();
      this.dragAnimationTimeout = setTimeout(() => {
        this.clearDragStyles();
      }, 250);
    } else {
      this.clearDragStyles();
    }
  }

  private snapClose(wasDragging: boolean) {
    const drawer = this.getDrawerInput();
    if (drawer && drawer.checked) {
      drawer.checked = false;
    }

    const panel = this.getSidebarPanel();
    const overlay = this.getDrawerOverlay();

    if (wasDragging && panel && overlay) {
      panel.style.transition = 'transform 240ms cubic-bezier(0.32, 0.72, 0, 1)';
      panel.style.transform = 'translateX(-100%)';
      overlay.style.transition = 'background-color 240ms cubic-bezier(0.32, 0.72, 0, 1)';
      overlay.style.backgroundColor = 'transparent';

      this.clearDragTimeout();
      this.dragAnimationTimeout = setTimeout(() => {
        this.clearDragStyles();
      }, 250);
    } else {
      this.clearDragStyles();
    }
  }

  private getSidebarPanel(): HTMLElement | null {
    if (this.elementRef?.nativeElement) {
      const el = this.elementRef.nativeElement.querySelector('.sidebar-panel');
      if (el) return el;
    }
    if (typeof document !== 'undefined') {
      return document.querySelector('.sidebar-panel');
    }
    return null;
  }

  private getDrawerOverlay(): HTMLElement | null {
    if (this.elementRef?.nativeElement) {
      const el = this.elementRef.nativeElement.querySelector('.drawer-overlay');
      if (el) return el;
    }
    if (typeof document !== 'undefined') {
      return document.querySelector('.drawer-overlay');
    }
    return null;
  }

  private getDrawerInput(): HTMLInputElement | null {
    if (this.elementRef?.nativeElement) {
      const el = this.elementRef.nativeElement.querySelector('#my-drawer-2');
      if (el) return el as HTMLInputElement;
    }
    if (typeof document !== 'undefined') {
      return document.getElementById('my-drawer-2') as HTMLInputElement | null;
    }
    return null;
  }

  private getSidebarPanelWidth(): number {
    const panel = this.getSidebarPanel();
    if (panel && panel.offsetWidth > 0) {
      return panel.offsetWidth;
    }
    return 288;
  }

  private clearDragTimeout() {
    if (this.dragAnimationTimeout !== null) {
      clearTimeout(this.dragAnimationTimeout);
      this.dragAnimationTimeout = null;
    }
  }

  private clearDragStyles() {
    this.clearDragTimeout();
    const panel = this.getSidebarPanel();
    const overlay = this.getDrawerOverlay();
    if (panel) {
      panel.style.transform = '';
      panel.style.transition = '';
    }
    if (overlay) {
      overlay.style.backgroundColor = '';
      overlay.style.transition = '';
    }
  }

  toggleSidebarCollapse() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    if (typeof localStorage !== 'undefined' && typeof localStorage?.setItem === 'function') {
      try {
        localStorage.setItem('sidebar_collapsed', String(this.isSidebarCollapsed));
      } catch {}
    }
  }

  logout() {
    this.authService.logout();
  }
}
