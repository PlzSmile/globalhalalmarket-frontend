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

  resendVerification(): Observable<unknown> {
    return this.http.post('/api/v1/auth/email/verification-notification', {});
  }

  private withCsrf<T>(request: () => Observable<T>): Observable<T> {
    return this.csrf().pipe(switchMap(request));
  }
}
