import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiItem, CompanyDetail, CompanyReminders, CompanySummary, CurrentUser, EmailCodeSent, PasswordChangeRequest, TwoFactorSetup, TwoFactorStatus } from '../models/auth';

@Injectable({ providedIn: 'root' })
export class MeApi {
  private readonly http = inject(HttpClient);

  updateProfile(name: string): Observable<CurrentUser> {
    return this.http.patch<ApiItem<CurrentUser>>('/api/v1/me', { name }).pipe(map((r) => r.data));
  }

  changePassword(body: PasswordChangeRequest): Observable<void> {
    return this.http.put<void>('/api/v1/me/password', body);
  }

  company(): Observable<CompanyDetail> {
    return this.http.get<ApiItem<CompanyDetail>>('/api/v1/company').pipe(map((r) => r.data));
  }

  updateReminders(change: Partial<CompanyReminders>): Observable<CompanyDetail> {
    return this.http.patch<ApiItem<CompanyDetail>>('/api/v1/company/reminders', change).pipe(map((r) => r.data));
  }

  updateCompany(name: string): Observable<CompanySummary> {
    return this.http.patch<ApiItem<CompanySummary>>('/api/v1/company', { name }).pipe(map((r) => r.data));
  }

  /** 3 Nov 2026: profile changes are unlocked by a code sent to the user's email (15 minutes). */
  sendProfileCode(): Observable<EmailCodeSent> {
    return this.http.post<ApiItem<EmailCodeSent>>('/api/v1/me/profile-code', {}).pipe(map((r) => r.data));
  }

  verifyProfileCode(code: string): Observable<{ unlocked_until: string }> {
    return this.http.post<ApiItem<{ unlocked_until: string }>>('/api/v1/me/profile-code/verify', { code }).pipe(map((r) => r.data));
  }

  /** The authenticator app for log-in. */
  twoFactor(): Observable<TwoFactorStatus> {
    return this.http.get<ApiItem<TwoFactorStatus>>('/api/v1/me/two-factor').pipe(map((r) => r.data));
  }

  startTwoFactor(password: string): Observable<TwoFactorSetup> {
    return this.http.post<ApiItem<TwoFactorSetup>>('/api/v1/me/two-factor', { password }).pipe(map((r) => r.data));
  }

  confirmTwoFactor(code: string): Observable<{ recovery_codes: readonly string[] }> {
    return this.http.post<ApiItem<{ recovery_codes: readonly string[] }>>('/api/v1/me/two-factor/confirm', { code }).pipe(map((r) => r.data));
  }

  newRecoveryCodes(password: string): Observable<{ recovery_codes: readonly string[] }> {
    return this.http.post<ApiItem<{ recovery_codes: readonly string[] }>>('/api/v1/me/two-factor/recovery-codes', { password }).pipe(map((r) => r.data));
  }

  disableTwoFactor(password: string): Observable<void> {
    return this.http.delete<void>('/api/v1/me/two-factor', { body: { password } });
  }
}
