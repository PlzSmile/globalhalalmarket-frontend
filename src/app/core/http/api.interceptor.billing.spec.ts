import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { apiInterceptor } from './api.interceptor';
import { AuthService } from '../auth/auth.service';
import { AccessService } from '../billing/access.service';
import { PlanLimitDialog } from '../../shared/ui/plan-limit-dialog';

/** Phase 7a: read-only (402) and plan limits (422 plan_limit) are handled in one place. */
describe('apiInterceptor billing answers', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  const snackBar = { open: vi.fn() };
  const dialog = { open: vi.fn() };
  const access = { markReadOnly: vi.fn() };
  const user = signal<{ role: string } | null>({ role: 'owner' });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: snackBar },
        { provide: MatDialog, useValue: dialog },
        { provide: AccessService, useValue: access },
        { provide: AuthService, useValue: { clear: vi.fn(), user } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    [snackBar.open, dialog.open, access.markReadOnly].forEach((f) => f.mockClear());
  });

  afterEach(() => backend.verify());

  it('marks the company read-only and says why on 402', async () => {
    http.post('/api/v1/suppliers', {}).subscribe({ error: () => undefined });
    backend.expectOne('/api/v1/suppliers').flush({ code: 'subscription_required', message: 'x' }, { status: 402, statusText: 'Payment Required' });

    expect(access.markReadOnly).toHaveBeenCalled();
    await vi.waitFor(() => expect(snackBar.open).toHaveBeenCalledWith('Your access has ended — choose a plan to keep editing.', 'Close', expect.any(Object)));
  });

  it('opens the plan limit dialog on 422 plan_limit, with See plans for the owner', async () => {
    http.post('/api/v1/suppliers', {}).subscribe({ error: () => undefined });
    backend.expectOne('/api/v1/suppliers').flush({ code: 'plan_limit', limit: 'suppliers', allowed: 50, message: 'Your Starter plan allows 50 suppliers.' },
      { status: 422, statusText: 'Unprocessable' });

    await vi.waitFor(() => expect(dialog.open).toHaveBeenCalled());
    expect(dialog.open).toHaveBeenCalledWith(PlanLimitDialog, expect.objectContaining({ data: { message: 'Your Starter plan allows 50 suppliers.', isOwner: true } }));
  });

  it('leaves ordinary validation errors to the form', async () => {
    http.post('/api/v1/suppliers', {}).subscribe({ error: () => undefined });
    backend.expectOne('/api/v1/suppliers').flush({ message: 'The name field is required.', errors: { name: ['Required'] } }, { status: 422, statusText: 'Unprocessable' });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(dialog.open).not.toHaveBeenCalled();
  });
});
