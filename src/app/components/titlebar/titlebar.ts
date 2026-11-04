import { Component, signal, OnInit, OnDestroy, Input, ChangeDetectionStrategy } from '@angular/core';
import { isTauri } from '@tauri-apps/api/core';
import type { Window as TauriWindow } from '@tauri-apps/api/window';

export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    isTauri() ||
    '__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window ||
    (window as any).isTauri === true ||
    window.location.hostname === 'tauri.localhost' ||
    window.location.protocol === 'tauri:'
  );
}

@Component({
  selector: 'app-titlebar',
  standalone: true,
  imports: [],
  templateUrl: './titlebar.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TitlebarComponent implements OnInit, OnDestroy {
  private _forceShow = signal<boolean>(false);
  @Input()
  get forceShow(): boolean {
    return this._forceShow();
  }
  set forceShow(val: boolean) {
    this._forceShow.set(val);
  }

  isDesktop = signal<boolean>(isDesktopApp());
  isMaximized = signal<boolean>(false);

  private appWindow: TauriWindow | null = null;
  private unlistenResize: (() => void) | null = null;

  constructor() {
    if (this.isDesktop() && typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--titlebar-height', '2rem');
    }
  }

  async ngOnInit() {
    if (this.forceShow || this.isDesktop() || isDesktopApp()) {
      this.isDesktop.set(true);
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--titlebar-height', '2rem');
      }

      if (typeof window !== 'undefined' && isDesktopApp()) {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          this.appWindow = getCurrentWindow();
          const max = await this.appWindow.isMaximized();
          this.isMaximized.set(max);

          this.unlistenResize = await this.appWindow.onResized(async () => {
            if (this.appWindow) {
              const currentMax = await this.appWindow.isMaximized();
              this.isMaximized.set(currentMax);
            }
          });
        } catch (err) {
          console.warn('Could not initialize Tauri window controls:', err);
        }
      }
    }
  }

  ngOnDestroy() {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--titlebar-height', '0px');
    }
    if (this.unlistenResize) {
      this.unlistenResize();
      this.unlistenResize = null;
    }
  }

  onHeaderMouseDown(event: MouseEvent) {
    if (event.button === 0 && !(event.target as HTMLElement)?.closest('button')) {
      this.appWindow?.startDragging();
    }
  }

  async minimize() {
    if (this.appWindow) {
      await this.appWindow.minimize();
    }
  }

  async toggleMaximize() {
    if (this.appWindow) {
      await this.appWindow.toggleMaximize();
      const max = await this.appWindow.isMaximized();
      this.isMaximized.set(max);
    } else {
      this.isMaximized.set(!this.isMaximized());
    }
  }

  async close() {
    if (this.appWindow) {
      await this.appWindow.close();
    }
  }
}
