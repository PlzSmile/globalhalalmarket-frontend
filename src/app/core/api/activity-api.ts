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

  page(cursor: string | null = null): Observable<ActivityPage> {
    const params = cursor ? new HttpParams().set('cursor', cursor) : undefined;
    return this.http.get<ActivityPage>('/api/v1/activity', { params });
  }
}
