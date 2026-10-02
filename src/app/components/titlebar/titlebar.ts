import { Component, signal, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow, Window as TauriWindow } from '@tauri-apps/api/window';

@Component({
  selector: 'app-titlebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './titlebar.html'
})
export class TitlebarComponent implements OnInit, OnDestroy {
  @Input() forceShow = false;

  isDesktop = signal<boolean>(false);
  isMaximized = signal<boolean>(false);

  private appWindow: TauriWindow | null = null;
  private unlistenResize: (() => void) | null = null;

  async ngOnInit() {
    if (this.forceShow || (typeof window !== 'undefined' && isTauri())) {
      this.isDesktop.set(true);
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--titlebar-height', '2rem');
      }

      if (typeof window !== 'undefined' && isTauri()) {
        try {
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
