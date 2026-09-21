import { Component } from '@angular/core';
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
  password = '';
  error = '';
  loading = false;
  apiUrl = '';

  constructor(private auth: AuthService, private router: Router, private config: ConfigService) {
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

  onSubmit() {
    if (!this.password || !this.apiUrl.trim()) return;

    this.loading = true;
    this.error = '';

    const candidates = this.getCandidateUrls(this.apiUrl);
    if (candidates.length === 0) {
      this.loading = false;
      this.error = 'Por favor ingresa una dirección válida';
      return;
    }

    this.tryLogin(candidates, 0);
  }

  private tryLogin(candidates: string[], index: number) {
    const currentUrl = candidates[index];

    this.auth.login(this.password, currentUrl).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        // Si falló por red/CORS/SSL/timeout (status === 0 o TimeoutError) y queda otro protocolo candidato
        const isNetworkOrTimeout = err.status === 0 || err.name === 'TimeoutError';
        if (isNetworkOrTimeout && index + 1 < candidates.length) {
          console.warn(`No se pudo conectar a ${currentUrl}, intentando con ${candidates[index + 1]}...`);
          this.tryLogin(candidates, index + 1);
          return;
        }

        this.loading = false;
        if (isNetworkOrTimeout) {
          this.error = 'No se pudo conectar al servidor. Revisa la dirección o verifica que el backend esté activo.';
        } else if (err.status === 401 || err.status === 400) {
          this.error = 'Contraseña incorrecta';
        } else {
          this.error = err.error?.detail || 'Error al iniciar sesión';
        }
      }
    });
  }
}
