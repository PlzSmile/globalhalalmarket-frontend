import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiItem } from '../models/auth';
import { LinkTarget, NamedRef, Paginated, SupplierDetail, SupplierInput, SupplierListItem } from '../models/catalogue';
import { linkBody, listParams } from './products-api';

@Injectable({ providedIn: 'root' })
export class SuppliersApi {
  private readonly http = inject(HttpClient);

  list(search: string, page: number): Observable<Paginated<SupplierListItem>> {
    return this.http.get<Paginated<SupplierListItem>>('/api/v1/suppliers', { params: listParams(search, page) });
  }

  /** For the LinkPicker: first page of matches as id/name pairs. */
  search(text: string): Observable<readonly NamedRef[]> {
    return this.list(text, 1).pipe(map((page) => page.data.map(({ id, name }) => ({ id, name }))));
  }

  get(id: number): Observable<SupplierDetail> {
    return this.http.get<ApiItem<SupplierDetail>>(`/api/v1/suppliers/${id}`).pipe(map((r) => r.data));
  }

  create(input: SupplierInput): Observable<SupplierDetail> {
    return this.http.post<ApiItem<SupplierDetail>>('/api/v1/suppliers', input).pipe(map((r) => r.data));
  }

  update(id: number, input: SupplierInput): Observable<SupplierDetail> {
    return this.http.patch<ApiItem<SupplierDetail>>(`/api/v1/suppliers/${id}`, input).pipe(map((r) => r.data));
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`/api/v1/suppliers/${id}`);
  }

  linkIngredient(supplierId: number, target: LinkTarget): Observable<SupplierDetail> {
    return this.http.post<ApiItem<SupplierDetail>>(`/api/v1/suppliers/${supplierId}/ingredients`, linkBody(target, 'ingredient_id')).pipe(map((r) => r.data));
  }

  unlinkIngredient(supplierId: number, ingredientId: number): Observable<void> {
    return this.http.delete<void>(`/api/v1/suppliers/${supplierId}/ingredients/${ingredientId}`);
  }
}
