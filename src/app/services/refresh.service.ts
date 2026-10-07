import { Injectable } from '@angular/core';
import { Observable, firstValueFrom, isObservable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export type RefreshHandler = () => Promise<any> | Observable<any> | void;

@Injectable({
  providedIn: 'root'
})
export class RefreshService {
  private activeHandler: RefreshHandler | null = null;

  register(handler: RefreshHandler): () => void {
    this.activeHandler = handler;
    return () => {
      if (this.activeHandler === handler) {
        this.activeHandler = null;
      }
    };
  }

  async triggerRefresh(): Promise<void> {
    if (!this.activeHandler) {
      await new Promise(resolve => setTimeout(resolve, 300));
      return;
    }

    try {
      const result = this.activeHandler();
      if (isObservable(result)) {
        await firstValueFrom(result.pipe(catchError(() => of(null))));
      } else if (result && typeof (result as any).then === 'function') {
        await result;
      }
    } catch (e) {
      console.error('Error during refresh:', e);
    }
  }
}
