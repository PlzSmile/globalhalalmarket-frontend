import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiItem } from '../models/auth';
import { BodyOption } from '../models/certificates';

@Injectable({ providedIn: 'root' })
export class BodiesApi {
  private readonly http = inject(HttpClient);

  search(text: string): Observable<readonly BodyOption[]> {
    const params = text ? new HttpParams().set('search', text) : new HttpParams();
    return this.http.get<ApiItem<readonly BodyOption[]>>('/api/v1/reference/bodies', { params }).pipe(map((r) => r.data));
  }
}
