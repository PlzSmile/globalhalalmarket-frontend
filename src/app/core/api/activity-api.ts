import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

/** One "who changed what" line (Phase 7). `link` is an app path like "/products/7", or null. */
export interface ActivityEntry {
  readonly id: number;
  readonly at: string;
  readonly actor: string;
  readonly event: string;
  readonly description: string;
  readonly changes: readonly { readonly field: string; readonly from: string | null; readonly to: string | null }[];
  readonly link: string | null;
}

export interface ActivityPage {
  readonly data: readonly ActivityEntry[];
  readonly meta: { readonly next_cursor: string | null };
}

/** Settings → Activity: newest first, 50 per page (owners and admins). */
@Injectable({ providedIn: 'root' })
export class ActivityApi {
  private readonly http = inject(HttpClient);

  /** `event`: only that kind of change (e.g. "reminders_changed" for the reminder settings history). */
  page(cursor: string | null = null, event: string | null = null): Observable<ActivityPage> {
    let params = new HttpParams();
    if (cursor) params = params.set('cursor', cursor);
    if (event) params = params.set('event', event);
    return this.http.get<ActivityPage>('/api/v1/activity', { params });
  }
}
