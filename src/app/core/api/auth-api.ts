import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap } from 'rxjs';
import { ApiItem, CurrentUser, EmailCodeSent, LoginChallenge, LoginCodeMethod, LoginRequest, RegisterRequest, ResetPasswordRequest } from '../models/auth';

/** Login/sign-up endpoints. State-changing calls fetch the Sanctum CSRF cookie first. */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);

  csrf(): Observable<void> {
    return this.http.get<void>('/sanctum/csrf-cookie');
  }

  me(): Observable<CurrentUser> {
    return this.http.get<ApiItem<CurrentUser>>('/api/v1/me').pipe(map((r) => r.data));
  }

  /** Step 1: the password. The server always asks for a code next (step 2). */
  login(body: LoginRequest): Observable<LoginChallenge> {
    return this.withCsrf(() => this.http.post<ApiItem<LoginChallenge>>('/api/v1/auth/login', body)).pipe(map((r) => r.data));
  }

  /** Step 2: the code; logs in. */
  verifyLogin(code: string, method: LoginCodeMethod): Observable<CurrentUser> {
    return this.http.post<ApiItem<CurrentUser>>('/api/v1/auth/login/verify', { code, method }).pipe(map((r) => r.data));
  }

  /** Send the login code by email (again, or instead of the app). */
  loginEmailCode(): Observable<EmailCodeSent> {
    return this.http.post<ApiItem<EmailCodeSent>>('/api/v1/auth/login/email-code', {}).pipe(map((r) => r.data));
  }

  register(body: RegisterRequest): Observable<CurrentUser> {
    return this.withCsrf(() => this.http.post<ApiItem<CurrentUser>>('/api/v1/auth/register', body)).pipe(map((r) => r.data));
  }

  logout(): Observable<void> {
    return this.withCsrf(() => this.http.post<void>('/api/v1/auth/logout', {}));
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.withCsrf(() => this.http.post<{ message: string }>('/api/v1/auth/forgot-password', { email }));
  }

  resetPassword(body: ResetPasswordRequest): Observable<{ message: string }> {
    return this.withCsrf(() => this.http.post<{ message: string }>('/api/v1/auth/reset-password', body));
  }

  /** 12 Nov 2026: emails a new 6-digit code (429 with resend_after while the last one is under 30 seconds old). */
  resendVerification(): Observable<{ message: string; resend_after?: number }> {
    return this.http.post<{ message: string; resend_after?: number }>('/api/v1/auth/email/verification-notification', {});
  }

  /** 12 Nov 2026: confirms the email address with the code from the email. */
  verifyEmailCode(code: string): Observable<CurrentUser> {
    return this.http.post<ApiItem<CurrentUser>>('/api/v1/auth/email/verify-code', { code }).pipe(map((r) => r.data));
  }

  private withCsrf<T>(request: () => Observable<T>): Observable<T> {
    return this.csrf().pipe(switchMap(request));
  }
}
