import { Component, inject } from '@angular/core';
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
export class Layout {
  isDarkTheme = false;
  private router = inject(Router);

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

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
    this.applyTheme();
  }

  private applyTheme() {
    const theme = this.isDarkTheme ? 'dark' : 'corporate';
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', theme);
    }
    if (typeof localStorage !== 'undefined' && typeof localStorage?.setItem === 'function') {
      try {
        localStorage.setItem('theme', theme);
      } catch {}
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
