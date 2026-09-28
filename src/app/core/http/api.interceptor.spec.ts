import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi } from 'vitest';
import { apiInterceptor } from './api.interceptor';
import { AuthService } from '../auth/auth.service';

describe('apiInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let router: Router;
  const snackBar = { open: vi.fn() };
  const auth = { clear: vi.fn() };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }), withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: snackBar },
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    snackBar.open.mockClear();
    auth.clear.mockClear();
  });

  afterEach(() => backend.verify());

  it('asks the API for JSON', () => {
    http.get('/api/v1/team').subscribe();
    const req = backend.expectOne('/api/v1/team');
    expect(req.request.headers.get('Accept')).toBe('application/json');
    req.flush({});
  });

  it('sends unverified users to /verify-email on 409', () => {
    http.get('/api/v1/team').subscribe({ error: () => undefined });
    backend.expectOne('/api/v1/team').flush({}, { status: 409, statusText: 'Conflict' });
    expect(router.navigate).toHaveBeenCalledWith(['/verify-email']);
  });

  it('clears the user and goes to login on 401 (but not for GET me)', () => {
    http.get('/api/v1/me').subscribe({ error: () => undefined });
    backend.expectOne('/api/v1/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.clear).not.toHaveBeenCalled();

    http.post('/api/v1/team/invitations', {}).subscribe({ error: () => undefined });
    backend.expectOne('/api/v1/team/invitations').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.clear).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], expect.objectContaining({ queryParams: expect.any(Object) }));
  });

  it('refreshes the CSRF cookie and retries once on 419', () => {
    let body: unknown;
    http.post('/api/v1/me/password', { a: 1 }).subscribe((r) => (body = r));
    backend.expectOne('/api/v1/me/password').flush({}, { status: 419, statusText: 'Page Expired' });
    backend.expectOne('/sanctum/csrf-cookie').flush(null, { status: 204, statusText: 'No Content' });
    backend.expectOne('/api/v1/me/password').flush({ ok: true });
    expect(body).toEqual({ ok: true });
  });

  it('goes to login when the retry after 419 answers 401 (session expired too)', () => {
    let failed = false;
    http.put('/api/v1/me/password', {}).subscribe({ error: () => (failed = true) });
    backend.expectOne('/api/v1/me/password').flush({}, { status: 419, statusText: 'Page Expired' });
    backend.expectOne('/sanctum/csrf-cookie').flush(null, { status: 204, statusText: 'No Content' });
    backend.expectOne('/api/v1/me/password').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(failed).toBe(true);
    expect(auth.clear).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], expect.objectContaining({ queryParams: expect.any(Object) }));
  });

  it('treats 401 on PATCH me (saving the profile) as an expired session', () => {
    http.patch('/api/v1/me', { name: 'A' }).subscribe({ error: () => undefined });
    backend.expectOne('/api/v1/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.clear).toHaveBeenCalled();
  });

  it('retries 419 only once', () => {
    let failed = false;
    http.post('/api/v1/team/invitations', {}).subscribe({ error: () => (failed = true) });
    backend.expectOne('/api/v1/team/invitations').flush({}, { status: 419, statusText: 'Page Expired' });
    backend.expectOne('/sanctum/csrf-cookie').flush(null, { status: 204, statusText: 'No Content' });
    backend.expectOne('/api/v1/team/invitations').flush({}, { status: 419, statusText: 'Page Expired' });
    backend.expectNone('/sanctum/csrf-cookie');
    expect(failed).toBe(true);
  });

  it('explains rate limits and server errors in a snackbar', () => {
    http.get('/api/v1/team').subscribe({ error: () => undefined });
    backend.expectOne('/api/v1/team').flush({}, { status: 429, statusText: 'Too Many Requests' });
    expect(snackBar.open).toHaveBeenCalledWith('Too many attempts. Please wait a minute and try again.', 'Close', { duration: 6000 });

    http.get('/api/v1/team').subscribe({ error: () => undefined });
    backend.expectOne('/api/v1/team').flush({}, { status: 500, statusText: 'Server Error' });
    expect(snackBar.open).toHaveBeenCalledWith('Something went wrong. Please try again.', 'Close', { duration: 6000 });
  });
});
