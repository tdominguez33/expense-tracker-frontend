import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { LoginView } from './login';

describe('LoginView - URL Resolution', () => {
  let component: LoginView;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoginView],
      providers: [provideHttpClient(), provideRouter([])]
    });
    const fixture = TestBed.createComponent(LoginView);
    component = fixture.componentInstance;
  });

  it('should preserve explicitly provided http:// and https:// URLs', () => {
    expect(component.getCandidateUrls('http://192.168.1.10:8000/')).toEqual(['http://192.168.1.10:8000']);
    expect(component.getCandidateUrls('https://api.midominio.com/')).toEqual(['https://api.midominio.com']);
  });

  it('should prioritize http and fallback to https for local addresses and dev ports', () => {
    expect(component.getCandidateUrls('localhost:8000')).toEqual([
      'http://localhost:8000',
      'https://localhost:8000'
    ]);
    expect(component.getCandidateUrls('127.0.0.1:8000')).toEqual([
      'http://127.0.0.1:8000',
      'https://127.0.0.1:8000'
    ]);
    expect(component.getCandidateUrls('192.168.1.50:8000')).toEqual([
      'http://192.168.1.50:8000',
      'https://192.168.1.50:8000'
    ]);
    expect(component.getCandidateUrls('10.0.0.15:5000')).toEqual([
      'http://10.0.0.15:5000',
      'https://10.0.0.15:5000'
    ]);
    expect(component.getCandidateUrls('servidor.local:3000')).toEqual([
      'http://servidor.local:3000',
      'https://servidor.local:3000'
    ]);
  });

  it('should prioritize https and fallback to http for public domain names', () => {
    expect(component.getCandidateUrls('gastos.midominio.com')).toEqual([
      'https://gastos.midominio.com',
      'http://gastos.midominio.com'
    ]);
    expect(component.getCandidateUrls('api.expenses.org')).toEqual([
      'https://api.expenses.org',
      'http://api.expenses.org'
    ]);
  });

  it('should prioritize https if explicit SSL port (443 or 8443) is used', () => {
    expect(component.getCandidateUrls('192.168.1.50:8443')).toEqual([
      'https://192.168.1.50:8443',
      'http://192.168.1.50:8443'
    ]);
  });

  it('should return empty list for empty or whitespace-only input', () => {
    expect(component.getCandidateUrls('   ')).toEqual([]);
  });
});
