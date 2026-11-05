import { DOCUMENT, DestroyRef, Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, Subscription, firstValueFrom } from 'rxjs';

/** How often an open, visible tab asks whether the company's data changed. */
export const LIVE_CHECK_MS = 20_000;

/**
 * 5 Nov 2026 (Bilal): screens refresh by themselves when the company's data changes (a supplier upload, a teammate,
 * a background job, another tab). The server keeps a "data version" per company (GET /api/v1/changes); this service
 * asks every 20 s while the tab is visible, and at once when the user comes back to the tab, and emits when the
 * version is different. A failed check is ignored (the next one tries again). Started by the Shell (logged in only).
 */
@Injectable({ providedIn: 'root' })
export class LiveChanges {
  // Optional: screens that use onLiveChange() also work in tests without an HTTP client (no checks then).
  private readonly http = inject(HttpClient, { optional: true });
  private readonly document = inject(DOCUMENT);
  private readonly changes = new Subject<void>();
  private version: string | null = null;
  private checking = false;
  private stopFn: (() => void) | null = null;

  /** Emits when the company's data changed since the last check. */
  readonly changed: Observable<void> = this.changes.asObservable();

  start(): void {
    if (this.stopFn) {
      return;
    }
    const timer = setInterval(() => void this.check(), LIVE_CHECK_MS);
    const onVisible = (): void => {
      if (this.document.visibilityState === 'visible') {
        void this.check();
      }
    };
    this.document.addEventListener('visibilitychange', onVisible);
    this.document.defaultView?.addEventListener('focus', onVisible);
    this.stopFn = () => {
      clearInterval(timer);
      this.document.removeEventListener('visibilitychange', onVisible);
      this.document.defaultView?.removeEventListener('focus', onVisible);
    };
    void this.check();
  }

  stop(): void {
    this.stopFn?.();
    this.stopFn = null;
    this.version = null;
  }

  async check(): Promise<void> {
    if (!this.http || this.checking || this.document.visibilityState === 'hidden') {
      return;
    }
    this.checking = true;
    try {
      const { data } = await firstValueFrom(this.http.get<{ data: { version: string } }>('/api/v1/changes'));
      const previous = this.version;
      this.version = data.version;
      if (previous !== null && previous !== data.version) {
        this.changes.next();
      }
    } catch {
      // offline or logged out: the next check tries again
    } finally {
      this.checking = false;
    }
  }
}

/**
 * In a screen's constructor: run `reload` whenever the company's data changes, until the screen closes.
 * The reload should keep the current data on screen (no loading skeleton).
 */
export function onLiveChange(reload: () => void): Subscription {
  const subscription = inject(LiveChanges).changed.subscribe(() => reload());
  inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  return subscription;
}
