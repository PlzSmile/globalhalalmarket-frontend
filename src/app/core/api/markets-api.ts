import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiItem } from '../models/auth';
import { AuthorityCode, MarketOption } from '../models/markets';

@Injectable({ providedIn: 'root' })
export class MarketsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<readonly MarketOption[]> {
    return this.http.get<ApiItem<readonly MarketOption[]>>('/api/v1/markets').pipe(map((r) => r.data));
  }

  update(codes: readonly AuthorityCode[]): Observable<readonly MarketOption[]> {
    return this.http.put<ApiItem<readonly MarketOption[]>>('/api/v1/markets', { authority_codes: codes }).pipe(map((r) => r.data));
  }
}
