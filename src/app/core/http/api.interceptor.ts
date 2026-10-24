import { Injector, inject } from '@angular/core';
import {
  HttpErrorResponse, HttpEvent, HttpEventType, HttpHeaders, HttpInterceptorFn, HttpRequest, HttpXsrfTokenExtractor,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, filter, from, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AccessService } from '../billing/access.service';
import { PlanLimitError } from '../models/billing';

const SNACK = { duration: 6000 } as const;

function isPlanLimit(body: unknown): body is PlanLimitError {
  return typeof body === 'object' && body !== null && (body as { code?: unknown }).code === 'plan_limit';
}

/** One place for API behaviour: JSON Accept header, session/CSRF expiry, unverified users, limits, server errors. */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/') && !req.url.startsWith('/sanctum/')) {
    return next(req);
  }

  const router = inject(Router);
  const auth = inject(AuthService);
  const xsrf = inject(HttpXsrfTokenExtractor);
  const injector = inject(Injector); // snack bar, dialog and access service only when needed (the access service uses HttpClient itself)
  const jsonReq = req.clone({ setHeaders: { Accept: 'application/json' } });

  // The snack bar (and its overlay code) is loaded on first use: keeps it out of the first download.
  const notify = (message: string): void => {
    void import('@angular/material/snack-bar').then(({ MatSnackBar }) => injector.get(MatSnackBar).open(message, 'Close', SNACK));
  };

  const handle = (error: unknown, canRetry: boolean): Observable<HttpEvent<unknown>> => {
    if (!(error instanceof HttpErrorResponse)) {
      return throwError(() => error);
    }

    // File downloads (responseType 'blob', e.g. the audit pack): the JSON error body arrives as a Blob — read it first.
    if (typeof Blob !== 'undefined' && error.error instanceof Blob) {
      return from(error.error.text()).pipe(switchMap((text) => {
        let body: unknown = text;
        try { body = JSON.parse(text); } catch { /* not JSON: keep the text */ }
        return handle(new HttpErrorResponse({ error: body, headers: error.headers, status: error.status, statusText: error.statusText, url: error.url ?? undefined }), canRetry);
      }));
    }

    if (error.status === 419 && canRetry) {
      // CSRF token expired (e.g. the form was open a long time): get a fresh cookie and retry once.
      // Errors from the retry (e.g. 401 because the session expired too) go through the same handling.
      const csrf = new HttpRequest('GET', '/sanctum/csrf-cookie', { headers: new HttpHeaders({ Accept: 'application/json' }) });
      return next(csrf).pipe(
        filter((event) => event.type === HttpEventType.Response),
        take(1),
        switchMap(() => next(jsonReq.clone({ setHeaders: { 'X-XSRF-TOKEN': xsrf.getToken() ?? '' } }))),
        catchError((retryError: unknown) => handle(retryError, false)),
      );
    }

    // GET me answers 401 for every visitor who is not logged in; that is normal, not an expired session.
    const isMeCheck = req.method === 'GET' && req.url === '/api/v1/me';
    if (error.status === 401 && !isMeCheck) {
      auth.clear();
      void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
    } else if (error.status === 409) {
      void router.navigate(['/verify-email']);
    } else if (error.status === 402) {
      // Phase 7a: the company is read-only (trial, free access or subscription ended).
      injector.get(AccessService).markReadOnly();
      notify('Your access has ended — choose a plan to keep editing.');
    } else if (error.status === 422 && isPlanLimit(error.error)) {
      const data = { message: error.error.message, isOwner: auth.user()?.role === 'owner' };
      // Loaded on first use: keeps the dialog out of the first download.
      void Promise.all([import('@angular/material/dialog'), import('../../shared/ui/plan-limit-dialog')])
        .then(([{ MatDialog }, { PlanLimitDialog }]) => injector.get(MatDialog).open(PlanLimitDialog, { data, maxWidth: '32rem' }));
    } else if (error.status === 429) {
      notify('Too many attempts. Please wait a minute and try again.');
    } else if (error.status === 0 || error.status >= 500) {
      notify('Something went wrong. Please try again.');
    }

    return throwError(() => error);
  };

  return next(jsonReq).pipe(catchError((error: unknown) => handle(error, true)));
};
