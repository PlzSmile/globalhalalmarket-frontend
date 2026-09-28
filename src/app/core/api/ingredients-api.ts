import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiItem } from '../models/auth';
import { DeleteIngredientResult, IngredientOption, IngredientSuppliers, LinkTarget } from '../models/catalogue';
import { linkBody } from './products-api';

@Injectable({ providedIn: 'root' })
export class IngredientsApi {
  private readonly http = inject(HttpClient);

  search(text: string): Observable<readonly IngredientOption[]> {
    const params = text ? new HttpParams().set('search', text) : new HttpParams();
    return this.http.get<ApiItem<readonly IngredientOption[]>>('/api/v1/ingredients', { params }).pipe(map((r) => r.data));
  }

  rename(id: number, name: string): Observable<IngredientOption> {
    return this.http.patch<ApiItem<IngredientOption>>(`/api/v1/ingredients/${id}`, { name }).pipe(map((r) => r.data));
  }

  remove(id: number): Observable<DeleteIngredientResult> {
    return this.http.delete<DeleteIngredientResult>(`/api/v1/ingredients/${id}`);
  }

  linkSupplier(ingredientId: number, target: LinkTarget): Observable<IngredientSuppliers> {
    return this.http.post<ApiItem<IngredientSuppliers>>(`/api/v1/ingredients/${ingredientId}/suppliers`, linkBody(target, 'supplier_id')).pipe(map((r) => r.data));
  }

  unlinkSupplier(ingredientId: number, supplierId: number): Observable<void> {
    return this.http.delete<void>(`/api/v1/ingredients/${ingredientId}/suppliers/${supplierId}`);
  }
}
