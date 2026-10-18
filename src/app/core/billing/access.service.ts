import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MeApi } from '../api/me-api';
import { CompanyAccess } from '../models/auth';

/**
 * Phase 7a: the company's access (trial, free, subscribed, read-only), loaded once for the banner on every page and
 * refreshed after billing changes. A 402 from any write marks the company read-only at once.
 */
@Injectable({ providedIn: 'root' })
export class AccessService {
  private readonly me = inject(MeApi);
  private readonly state = signal<CompanyAccess | null>(null);
  readonly access = this.state.asReadonly();

  async refresh(): Promise<void> {
    try {
      this.state.set((await firstValueFrom(this.me.company())).access ?? null);
    } catch {
      // Information only: the app keeps working without the banner.
    }
  }

  markReadOnly(): void {
    const current = this.state();
    if (current !== null && current.can_write) {
      this.state.set({ ...current, state: 'read_only', can_write: false });
    } else if (current === null) {
      void this.refresh();
    }
  }
}
