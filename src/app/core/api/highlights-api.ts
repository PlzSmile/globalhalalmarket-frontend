import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { Highlights } from '../models/highlights';

/** Public list facts for the login page. A failure just means the panel shows its fixed text only. */
@Injectable({ providedIn: 'root' })
export class HighlightsApi {
  private readonly http = inject(HttpClient);

  /** One request per visit, shared by every screen that shows the panel. */
  private readonly cached = this.http.get<{ data: Highlights }>('/api/v1/highlights')
    .pipe(map((r) => r.data), catchError(() => of(null)), shareReplay({ bufferSize: 1, refCount: false }));

  get(): Observable<Highlights | null> {
    return this.cached;
  }
}
