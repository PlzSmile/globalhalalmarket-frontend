import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiItem } from '../models/auth';
import { AuthorityCode } from '../models/markets';
import { CreatedShareLink, ShareLinkItem } from '../models/share-links';

@Injectable({ providedIn: 'root' })
export class ShareLinksApi {
  private readonly http = inject(HttpClient);

  list(productId: number): Observable<readonly ShareLinkItem[]> {
    return this.http.get<ApiItem<readonly ShareLinkItem[]>>(`/api/v1/products/${productId}/share-links`).pipe(map((r) => r.data));
  }

  create(productId: number, market: AuthorityCode): Observable<CreatedShareLink> {
    return this.http.post<ApiItem<CreatedShareLink>>(`/api/v1/products/${productId}/share-links`, { market }).pipe(map((r) => r.data));
  }

  link(id: number): Observable<string> {
    return this.http.get<ApiItem<{ url: string }>>(`/api/v1/share-links/${id}/link`).pipe(map((r) => r.data.url));
  }

  stop(id: number): Observable<void> {
    return this.http.delete<void>(`/api/v1/share-links/${id}`);
  }
}
