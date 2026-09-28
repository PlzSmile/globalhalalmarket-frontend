import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiItem } from '../models/auth';
import { LinkTarget, Paginated, ProductDetail, ProductInput, ProductListItem } from '../models/catalogue';

export function listParams(search: string, page: number): HttpParams {
  let params = new HttpParams().set('page', String(page));
  if (search) {
    params = params.set('search', search);
  }
  return params;
}

export function linkBody(target: LinkTarget, idField: string): Record<string, string | number> {
  return 'id' in target ? { [idField]: target.id } : { name: target.name };
}

@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly http = inject(HttpClient);

  list(search: string, page: number): Observable<Paginated<ProductListItem>> {
    return this.http.get<Paginated<ProductListItem>>('/api/v1/products', { params: listParams(search, page) });
  }

  get(id: number): Observable<ProductDetail> {
    return this.http.get<ApiItem<ProductDetail>>(`/api/v1/products/${id}`).pipe(map((r) => r.data));
  }

  create(input: ProductInput): Observable<ProductDetail> {
    return this.http.post<ApiItem<ProductDetail>>('/api/v1/products', input).pipe(map((r) => r.data));
  }

  update(id: number, input: ProductInput): Observable<ProductDetail> {
    return this.http.patch<ApiItem<ProductDetail>>(`/api/v1/products/${id}`, input).pipe(map((r) => r.data));
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`/api/v1/products/${id}`);
  }

  linkIngredient(productId: number, target: LinkTarget): Observable<ProductDetail> {
    return this.http.post<ApiItem<ProductDetail>>(`/api/v1/products/${productId}/ingredients`, linkBody(target, 'ingredient_id')).pipe(map((r) => r.data));
  }

  unlinkIngredient(productId: number, ingredientId: number): Observable<void> {
    return this.http.delete<void>(`/api/v1/products/${productId}/ingredients/${ingredientId}`);
  }
}
