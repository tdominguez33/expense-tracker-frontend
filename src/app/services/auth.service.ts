import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, timeout } from 'rxjs';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private config = inject(ConfigService);
  private readonly TOKEN_KEY = 'expense_tracker_token';
  
  private authState = new BehaviorSubject<boolean>(this.hasToken());
  public isAuthenticated$ = this.authState.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  private hasToken(): boolean {
    return !!this.getToken();
  }

  public getToken(): string | null {
    if (typeof localStorage !== 'undefined' && typeof localStorage?.getItem === 'function') {
      try {
        return localStorage.getItem(this.TOKEN_KEY);
      } catch {}
    }
    return null;
  }

  public isAuthenticated(): boolean {
    return this.authState.value;
  }

  public login(password: string, apiUrl?: string): Observable<any> {
    const formData = new FormData();
    formData.append('username', 'admin');
    formData.append('password', password);

    const baseUrl = (apiUrl || this.config.apiUrl()).trim().replace(/\/+$/, '');

    return this.http.post<{access_token: string, token_type: string}>(`${baseUrl}/token`, formData)
      .pipe(
        timeout(6000),
        tap({
          next: (response) => {
            if (apiUrl) {
              this.config.setApiUrl(baseUrl);
            }
            if (typeof localStorage !== 'undefined' && typeof localStorage?.setItem === 'function') {
              try {
                localStorage.setItem(this.TOKEN_KEY, response.access_token);
              } catch {}
            }
            this.authState.next(true);
          },
          error: (err) => {
            // Si el servidor respondió con un status HTTP (ej. 401 contraseña incorrecta),
            // la URL es alcanzable y válida.
            if (err.status && err.status !== 0 && apiUrl) {
              this.config.setApiUrl(baseUrl);
            }
          }
        })
      );
  }

  public logout(): void {
    if (typeof localStorage !== 'undefined' && typeof localStorage?.removeItem === 'function') {
      try {
        localStorage.removeItem(this.TOKEN_KEY);
      } catch {}
    }
    this.authState.next(false);
    this.router.navigate(['/login']);
  }
}
