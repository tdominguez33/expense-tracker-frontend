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
  apiUrl = '';

  // First-time activation state (Option A)
  setupMode = signal<boolean>(false);
  setupToken = signal<string>('');
  resolvedApiUrl = '';
  newPassword = '';
  confirmPassword = '';

  error = signal<string>('');
  isRateLimited = signal<boolean>(false);
  loading = signal<boolean>(false);

  constructor() {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
    const current = this.config.apiUrl();
    this.apiUrl = current.replace(/^https?:\/\//i, '');
  }

  /**
   * Generates candidate URLs to test based on whether a protocol was specified,
   * whether it is a local address/port or a domain, and the page's HTTP/HTTPS context.
   */
  public getCandidateUrls(input: string): string[] {
    const clean = input.trim().replace(/\/+$/, '');
    if (!clean) return [];

    // If the user explicitly specified http:// or https://, respect it
    if (/^https?:\/\//i.test(clean)) {
      return [clean];
    }

    // If the web runs over HTTPS (production web), browsers block HTTP requests (Mixed Content).
    // In desktop environments like Tauri (tauri.localhost), do not force HTTPS indiscriminately.
    const isHttpsPage = typeof window !== 'undefined' && 
      window.location?.protocol === 'https:' && 
      !window.location.hostname.includes('localhost');
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

    // Public domain without port or non-standard ports: prioritize https and fallback to http
    return [`https://${clean}`, `http://${clean}`];
  }

  private readonly MIN_LOADING_TIME = 600; // ms
  private submitStartTime = 0;

  onSubmit() {
    if (!this.password || !this.apiUrl.trim()) return;

    this.submitStartTime = Date.now();
    this.loading.set(true);
    this.error.set('');
    this.isRateLimited.set(false);

    const candidates = this.getCandidateUrls(this.apiUrl);
    if (candidates.length === 0) {
      this.loading.set(false);
      this.error.set('Por favor ingresa una dirección válida');
      this.cdr.markForCheck();
      return;
    }

    this.tryLogin(candidates, 0);
  }

  onSubmitSetup() {
    if (!this.newPassword || !this.confirmPassword) return;

    this.error.set('');
    this.isRateLimited.set(false);

    if (this.newPassword.length < 6) {
      this.error.set('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.error.set('Las contraseñas no coinciden');
      return;
    }

    this.submitStartTime = Date.now();
    this.loading.set(true);

    this.auth.completeSetup(
      this.setupToken(),
      this.newPassword,
      this.confirmPassword,
      this.resolvedApiUrl
    ).subscribe({
      next: () => {
        this.finishWithDelay(() => {
          this.router.navigate(['/dashboard']);
        });
      },
      error: (err) => {
        this.finishWithDelay(() => {
          if (err.status === 401) {
            this.setupMode.set(false);
            this.setupToken.set('');
            this.error.set(err.error?.detail || 'El código de activación expiró. Ingresa nuevamente.');
          } else if (err.status === 429) {
            this.isRateLimited.set(true);
            this.error.set(err.error?.detail || 'Demasiados intentos. Espera un minuto.');
          } else {
            this.error.set(err.error?.detail || 'Error al configurar la contraseña.');
          }
        });
      }
    });
  }

  cancelSetup() {
    this.setupMode.set(false);
    this.setupToken.set('');
    this.newPassword = '';
    this.confirmPassword = '';
    this.error.set('');
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
      next: (response) => {
        this.finishWithDelay(() => {
          if (response?.status === 'SETUP_REQUIRED' && response?.setup_token) {
            this.resolvedApiUrl = currentUrl;
            this.setupToken.set(response.setup_token);
            this.setupMode.set(true);
            this.password = '';
            this.newPassword = '';
            this.confirmPassword = '';
            this.error.set('');
            return;
          }
          this.router.navigate(['/dashboard']);
        });
      },
      error: (err) => {
        const isTimeout = err.name === 'TimeoutError';
        const isNetworkError = err.status === 0;

        // If it failed due to network or timeout and there is another candidate protocol
        if ((isTimeout || isNetworkError) && index + 1 < candidates.length) {
          console.warn(`No se pudo conectar a ${currentUrl}, intentando con ${candidates[index + 1]}...`);
          this.tryLogin(candidates, index + 1);
          return;
        }

        this.finishWithDelay(() => {
          if (err.status === 429) {
            this.isRateLimited.set(true);
            this.error.set(
              err.error?.detail || 'Demasiados intentos de inicio de sesión. Espera un minuto e intenta nuevamente.'
            );
          } else if (err.status === 401) {
            const detail = err.error?.detail;
            this.error.set(
              detail === 'Código de activación incorrecto' ? detail : 'Contraseña incorrecta'
            );
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
