import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiItem } from '../models/auth';
import { Paginated } from '../models/catalogue';
import { ComplianceFilters, HistoryEntry, MarketBreakdown, ProductComplianceRow, StatusOnDate } from '../models/compliance';

@Injectable({ providedIn: 'root' })
export class ComplianceApi {
  private readonly http = inject(HttpClient);

  products(filters: ComplianceFilters): Observable<Paginated<ProductComplianceRow>> {
    let params = new HttpParams().set('page', String(filters.page));
    if (filters.market) { params = params.set('market', filters.market); }
    if (filters.status) { params = params.set('status', filters.status); }
    if (filters.supplier !== null) { params = params.set('supplier', String(filters.supplier)); }
    if (filters.search) { params = params.set('search', filters.search); }
    return this.http.get<Paginated<ProductComplianceRow>>('/api/v1/compliance/products', { params });
  }

  product(id: number): Observable<readonly MarketBreakdown[]> {
    return this.http.get<ApiItem<readonly MarketBreakdown[]>>(`/api/v1/compliance/products/${id}`).pipe(map((r) => r.data));
  }

  history(id: number, page: number): Observable<Paginated<HistoryEntry>> {
    return this.http.get<Paginated<HistoryEntry>>(`/api/v1/compliance/products/${id}/history`, { params: new HttpParams().set('page', String(page)) });
  }

  statusOn(id: number, isoDate: string): Observable<StatusOnDate> {
    return this.http.get<ApiItem<StatusOnDate>>(`/api/v1/compliance/products/${id}/history`, { params: new HttpParams().set('on', isoDate) }).pipe(map((r) => r.data));
  }
}
