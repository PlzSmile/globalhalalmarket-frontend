import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiItem, CompanySummary, CurrentUser, PasswordChangeRequest } from '../models/auth';

@Injectable({ providedIn: 'root' })
export class MeApi {
  private readonly http = inject(HttpClient);

  updateProfile(name: string): Observable<CurrentUser> {
    return this.http.patch<ApiItem<CurrentUser>>('/api/v1/me', { name }).pipe(map((r) => r.data));
  }

  changePassword(body: PasswordChangeRequest): Observable<void> {
    return this.http.put<void>('/api/v1/me/password', body);
  }

  updateCompany(name: string): Observable<CompanySummary> {
    return this.http.patch<ApiItem<CompanySummary>>('/api/v1/company', { name }).pipe(map((r) => r.data));
  }
}
