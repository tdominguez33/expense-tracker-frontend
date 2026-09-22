import { Component, ChangeDetectorRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html'
})
export class LoginView {
  private auth = inject(AuthService);
  private router = inject(Router);
  private config = inject(ConfigService);
  private cdr = inject(ChangeDetectorRef);

  password = '';
  error = signal<string>('');
  loading = signal<boolean>(false);
  apiUrl = '';

  constructor() {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
    const current = this.config.apiUrl();
    this.apiUrl = current.replace(/^https?:\/\//i, '');
  }

  /**
   * Genera las URLs candidatas a probar basándose en si se especificó protocolo,
   * si es una dirección local/puerto o un dominio, y el contexto HTTP/HTTPS de la página.
   */
  public getCandidateUrls(input: string): string[] {
    const clean = input.trim().replace(/\/+$/, '');
    if (!clean) return [];

    // Si el usuario especificó explícitamente http:// o https://, respetarlo
    if (/^https?:\/\//i.test(clean)) {
      return [clean];
    }

    // Si la web corre sobre HTTPS, los navegadores bloquean peticiones HTTP (Mixed Content)
    const isHttpsPage = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    if (isHttpsPage) {
      return [`https://${clean}`];
    }

    const isExplicitSslPort = /:(443|8443)$/.test(clean);
    const isExplicitHttpPort = /:(80|8000|8080|5000|3000)$/.test(clean);
    const isLocalHost = /^(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|.*\.local)(:\d+)?$/i.test(clean);

    if (isExplicitSslPort) {
      return [`https://${clean}`, `http://${clean}`];
    }

    if (isLocalHost || isExplicitHttpPort) {
      return [`http://${clean}`, `https://${clean}`];
    }

    // Dominio público sin puerto o puertos no habituales: priorizar https y fallback a http
    return [`https://${clean}`, `http://${clean}`];
  }

  private readonly MIN_LOADING_TIME = 600; // ms
  private submitStartTime = 0;

  onSubmit() {
    if (!this.password || !this.apiUrl.trim()) return;

    this.submitStartTime = Date.now();
    this.loading.set(true);
    this.error.set('');

    const candidates = this.getCandidateUrls(this.apiUrl);
    if (candidates.length === 0) {
      this.loading.set(false);
      this.error.set('Por favor ingresa una dirección válida');
      this.cdr.markForCheck();
      return;
    }

    this.tryLogin(candidates, 0);
  }

  private finishWithDelay(action: () => void) {
    const elapsed = Date.now() - this.submitStartTime;
    const remaining = Math.max(0, this.MIN_LOADING_TIME - elapsed);

    if (remaining > 0) {
      setTimeout(() => {
        this.loading.set(false);
        action();
        this.cdr.markForCheck();
      }, remaining);
    } else {
      this.loading.set(false);
      action();
      this.cdr.markForCheck();
    }
  }

  private tryLogin(candidates: string[], index: number) {
    const currentUrl = candidates[index];

    this.auth.login(this.password, currentUrl).subscribe({
      next: () => {
        this.finishWithDelay(() => {
          this.router.navigate(['/dashboard']);
        });
      },
      error: (err) => {
        const isTimeout = err.name === 'TimeoutError';
        const isNetworkError = err.status === 0;

        // Si falló por red o timeout y queda otro protocolo candidato
        if ((isTimeout || isNetworkError) && index + 1 < candidates.length) {
          console.warn(`No se pudo conectar a ${currentUrl}, intentando con ${candidates[index + 1]}...`);
          this.tryLogin(candidates, index + 1);
          return;
        }

        this.finishWithDelay(() => {
          if (err.status === 401) {
            this.error.set('Contraseña incorrecta');
          } else if (err.status === 400) {
            this.error.set(err.error?.detail || 'Contraseña incorrecta');
          } else if (isTimeout || isNetworkError) {
            this.error.set('No se pudo conectar al servidor');
          } else {
            this.error.set(err.error?.detail || 'No se pudo conectar al servidor');
          }
        });
      }
    });
  }
}
