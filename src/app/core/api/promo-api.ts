import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { Promo } from '../models/promo';

/** The current promotion for the sign-up page. A failure just means no promotion is shown. */
@Injectable({ providedIn: 'root' })
export class PromoApi {
  private readonly http = inject(HttpClient);

  current(): Observable<Promo | null> {
    return this.http.get<{ data: Promo | null }>('/api/v1/promo').pipe(map((r) => r.data), catchError(() => of(null)));
  }
}
