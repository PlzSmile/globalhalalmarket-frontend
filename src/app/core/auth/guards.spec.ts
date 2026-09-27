import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { authGuard, guestGuard, unverifiedGuard } from './guards';
import { AuthService } from './auth.service';
import { CurrentUser } from '../models/auth';

const verified: CurrentUser = { id: 1, name: 'A', email: 'a@x.com', role: 'member', email_verified: true, company: { id: 1, name: 'C' } };
const unverified: CurrentUser = { ...verified, email_verified: false };

function setup(user: CurrentUser | null): Router {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: { ensureLoaded: vi.fn().mockResolvedValue(user) } }],
  });
  return TestBed.inject(Router);
}

const run = (guard: typeof authGuard, url = '/settings') =>
  TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot)) as Promise<boolean | UrlTree>;

describe('guards', () => {
  it('authGuard sends guests to login with a return URL', async () => {
    const router = setup(null);
    expect(router.serializeUrl((await run(authGuard)) as UrlTree)).toBe('/login?returnUrl=%2Fsettings');
  });

  it('authGuard sends unverified users to verify-email and lets verified users in', async () => {
    const router = setup(unverified);
    expect(router.serializeUrl((await run(authGuard)) as UrlTree)).toBe('/verify-email');

    setup(verified);
    expect(await run(authGuard)).toBe(true);
  });

  it('guestGuard sends logged-in users to the dashboard', async () => {
    const router = setup(verified);
    expect(router.serializeUrl((await run(guestGuard)) as UrlTree)).toBe('/dashboard');
  });

  it('unverifiedGuard only lets logged-in, unverified users in', async () => {
    let router = setup(null);
    expect(router.serializeUrl((await run(unverifiedGuard)) as UrlTree)).toBe('/login');
    router = setup(verified);
    expect(router.serializeUrl((await run(unverifiedGuard)) as UrlTree)).toBe('/dashboard');
    setup(unverified);
    expect(await run(unverifiedGuard)).toBe(true);
  });
});
