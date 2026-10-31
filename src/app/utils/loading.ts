import { Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap, timer } from 'rxjs';

/**
 * Retorna un Signal<boolean> que solo se vuelve `true` si el signal de carga
 * permanece en `true` durante más de `delayMs` (300 ms por defecto).
 *
 * Si la petición responde antes de ese tiempo (ej. 50 ms), el spinner
 * nunca se llega a mostrar, eliminando cualquier efecto de parpadeo (flicker).
 */
export function debouncedLoading(loadingSignal: Signal<boolean>, delayMs = 300): Signal<boolean> {
  const debounced$ = toObservable(loadingSignal).pipe(
    switchMap(isLoading => (isLoading ? timer(delayMs).pipe(switchMap(() => of(true))) : of(false)))
  );
  return toSignal(debounced$, { initialValue: false })!;
}
