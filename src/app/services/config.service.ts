import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private readonly STORAGE_KEY = 'expense_tracker_api_url';
  private readonly DEFAULT_URL = '';

  apiUrl = signal<string>(this.getStoredUrl());

  constructor() {}

  private getStoredUrl(): string {
    if (typeof localStorage !== 'undefined' && typeof localStorage?.getItem === 'function') {
      try {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        return stored ? stored : this.DEFAULT_URL;
      } catch {}
    }
    return this.DEFAULT_URL;
  }

  setApiUrl(url: string) {
    const cleaned = url.trim().replace(/\/+$/, '');
    if (typeof localStorage !== 'undefined' && typeof localStorage?.setItem === 'function') {
      try {
        localStorage.setItem(this.STORAGE_KEY, cleaned);
      } catch {}
    }
    this.apiUrl.set(cleaned);
  }
}
