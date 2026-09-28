import { inject } from '@angular/core';
import {
  HttpErrorResponse, HttpEvent, HttpEventType, HttpHeaders, HttpInterceptorFn, HttpRequest, HttpXsrfTokenExtractor,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

const SNACK = { duration: 6000 } as const;

/** One place for API behaviour: JSON Accept header, session/CSRF expiry, unverified users, limits, server errors. */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/') && !req.url.startsWith('/sanctum/')) {
    return next(req);
  }

  const router = inject(Router);
  const auth = inject(AuthService);
  const snackBar = inject(MatSnackBar);
  const xsrf = inject(HttpXsrfTokenExtractor);
  const jsonReq = req.clone({ setHeaders: { Accept: 'application/json' } });

  const handle = (error: unknown, canRetry: boolean): Observable<HttpEvent<unknown>> => {
    if (!(error instanceof HttpErrorResponse)) {
      return throwError(() => error);
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
    } else if (error.status === 429) {
      snackBar.open('Too many attempts. Please wait a minute and try again.', 'Close', SNACK);
    } else if (error.status === 0 || error.status >= 500) {
      snackBar.open('Something went wrong. Please try again.', 'Close', SNACK);
    }

    return throwError(() => error);
  };

  return next(jsonReq).pipe(catchError((error: unknown) => handle(error, true)));
};
