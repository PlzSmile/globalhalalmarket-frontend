import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiItem, CurrentUser, SwitchableCompanies, SwitchableCompany } from '../models/auth';

/** Phase 7c: a consultant's own company and its client companies. */
@Injectable({ providedIn: 'root' })
export class CompaniesApi {
  private readonly http = inject(HttpClient);

  list(): Observable<SwitchableCompanies> {
    return this.http.get<SwitchableCompanies>('/api/v1/companies');
  }

  addClient(name: string): Observable<SwitchableCompany> {
    return this.http.post<ApiItem<SwitchableCompany>>('/api/v1/companies', { name }).pipe(map((r) => r.data));
  }

  switchTo(id: number): Observable<CurrentUser> {
    return this.http.post<ApiItem<CurrentUser>>(`/api/v1/companies/${id}/switch`, {}).pipe(map((r) => r.data));
  }
}
