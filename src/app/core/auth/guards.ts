import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { CurrentUser } from '../models/auth';

/** Call at the very start of a guard: inject() must run before the first await. */
function currentUser(): Promise<CurrentUser | null> {
  return inject(AuthService).ensureLoaded().catch(() => null);
}

/** Tracker pages: logged in AND email verified. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const user = await currentUser();
  if (!user) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  return user.email_verified ? true : router.createUrlTree(['/verify-email']);
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
  return user.email_verified ? router.createUrlTree(['/dashboard']) : true;
};
