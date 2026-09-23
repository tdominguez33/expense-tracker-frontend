import { Component, inject, OnInit, OnDestroy } from '@angular/core';
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
  isDarkTheme = false;
  private router = inject(Router);

  private edgeTouchStartX = 0;
  private edgeTouchStartY = 0;
  private currentTouchX = 0;
  private currentTouchY = 0;
  private isEdgeSwiping = false;
  private isDrawerSwiping = false;

  constructor(private authService: AuthService) {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed()
    ).subscribe(() => {
      this.closeDrawer();
    });
    let storedTheme: string | null = null;
    if (typeof localStorage !== 'undefined' && typeof localStorage?.getItem === 'function') {
      try {
        storedTheme = localStorage.getItem('theme');
      } catch {}
    }

    if (storedTheme) {
      this.isDarkTheme = storedTheme === 'dark';
    } else if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.isDarkTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    this.applyTheme();
  }

  ngOnInit() {
    if (typeof window !== 'undefined') {
      window.addEventListener('touchstart', this.onGlobalTouchStart, { passive: false });
      window.addEventListener('touchmove', this.onGlobalTouchMove, { passive: false });
      window.addEventListener('touchend', this.onGlobalTouchEnd, { passive: true });
    }
  }

  ngOnDestroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('touchstart', this.onGlobalTouchStart);
      window.removeEventListener('touchmove', this.onGlobalTouchMove);
      window.removeEventListener('touchend', this.onGlobalTouchEnd);
    }
  }

  onGlobalTouchStart = (e: TouchEvent) => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) return;
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    this.edgeTouchStartX = touch.clientX;
    this.edgeTouchStartY = touch.clientY;
    this.currentTouchX = touch.clientX;
    this.currentTouchY = touch.clientY;

    if (!this.isDrawerOpen()) {
      // Excluir la zona superior de la navbar para permitir tocar el botón de menú sin interferencias
      let isTopNavbar = false;
      const target = e.target as HTMLElement | null;
      if (target?.closest('.navbar, label[for="my-drawer-2"]')) {
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
        return;
      }

      // Excluir elementos interactivos (botones, enlaces, etc.) para permitir clics normales sin interferencia de swipe
      const isInteractive = target?.closest('button, a, input, select, textarea, [role="button"], .btn');
      if (isInteractive) {
        this.isEdgeSwiping = false;
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

    if (this.isEdgeSwiping && e.cancelable) {
      e.preventDefault();
    }
  };

  onGlobalTouchEnd = (e: TouchEvent) => {
    if (this.isEdgeSwiping) {
      const deltaX = this.currentTouchX - this.edgeTouchStartX;
      const deltaY = Math.abs(this.currentTouchY - this.edgeTouchStartY);
      this.isEdgeSwiping = false;

      if (deltaX > 40 && deltaX > deltaY * 1.2) {
        this.openDrawer();
      }
    } else if (this.isDrawerSwiping) {
      const deltaX = this.currentTouchX - this.edgeTouchStartX;
      const deltaY = Math.abs(this.currentTouchY - this.edgeTouchStartY);
      this.isDrawerSwiping = false;

      if (deltaX < -40 && Math.abs(deltaX) > deltaY * 1.2) {
        this.closeDrawer();
      }
    }
  };

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
    this.applyTheme();
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
    if (typeof document !== 'undefined') {
      const drawer = document.getElementById('my-drawer-2') as HTMLInputElement | null;
      return !!drawer?.checked;
    }
    return false;
  }

  openDrawer() {
    if (typeof document !== 'undefined') {
      const drawer = document.getElementById('my-drawer-2') as HTMLInputElement | null;
      if (drawer && !drawer.checked) {
        drawer.checked = true;
      }
    }
  }

  closeDrawer() {
    if (typeof document !== 'undefined') {
      const drawer = document.getElementById('my-drawer-2') as HTMLInputElement | null;
      if (drawer && drawer.checked) {
        drawer.checked = false;
      }
    }
  }

  logout() {
    this.authService.logout();
  }
}
