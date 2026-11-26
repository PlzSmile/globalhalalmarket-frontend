import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { CurrentUser } from '../models/auth';
import { returnUrlParams } from './return-url';

/** Call at the very start of a guard: inject() must run before the first await. */
function currentUser(): Promise<CurrentUser | null> {
  return inject(AuthService).ensureLoaded().catch(() => null);
}

/** Tracker pages: logged in AND email verified. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const user = await currentUser();
  if (!user) {
    return router.createUrlTree(['/login'], { queryParams: returnUrlParams(state.url) });
  }
  if (!user.email_verified) {
    return router.createUrlTree(['/verify-email']);
  }
  // 12 Nov 2026: the owner of a new sign-up sets up the account first (authenticator app, company details, logo).
  return user.setup_required ? router.createUrlTree(['/setup']) : true;
};

/** The first-run setup wizard: only for a verified owner whose company still needs it. */
export const setupGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const user = await currentUser();
  if (!user) {
    return router.createUrlTree(['/login']);
  }
  if (!user.email_verified) {
    return router.createUrlTree(['/verify-email']);
  }
  return user.setup_required ? true : router.createUrlTree(['/dashboard']);
};

/** Login, sign-up and password pages: only for people who are not logged in. */
export const guestGuard: CanActivateFn = async () => {
  const router = inject(Router);
  return (await currentUser()) ? router.createUrlTree(['/dashboard']) : true;
};

/** The "check your email" page. */
export const unverifiedGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const user = await currentUser();
  if (!user) {
    return router.createUrlTree(['/login']);
  }
  if (!user.email_verified) {
    return true;
  }
  return router.createUrlTree([user.setup_required ? '/setup' : '/dashboard']);
};
