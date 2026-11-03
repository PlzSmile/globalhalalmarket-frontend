import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { ActivatedRouteSnapshot, NavigationEnd, provideRouter, Router, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { filter } from 'rxjs';
import { registerIcons } from './core/icons/icons';
import { apiInterceptor } from './core/http/api.interceptor';
import { AuthService } from './core/auth/auth.service';
import { routes } from './app.routes';

/**
 * A new page starts at the top, but a change of only the query (a dashboard count filtering the table, a tab, a page
 * of results) keeps the scroll position, so the page can glide to what changed (Bilal, 3 Nov 2026).
 */
function scrollToTopOnNewPage(): void {
  let lastPath = '';
  inject(Router).events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
    const path = e.urlAfterRedirects.split(/[?#]/)[0];
    if (path !== lastPath) {
      lastPath = path;
      globalThis.scrollTo?.({ top: 0 });
    }
  });
}

/** The page path of a route snapshot (every segment down to the leaf, without the query). */
function pathOf(snapshot: ActivatedRouteSnapshot): string {
  const parts: string[] = [];
  for (let s: ActivatedRouteSnapshot | null = snapshot.root; s; s = s.firstChild) {
    parts.push(...s.url.map((u) => u.path));
  }
  return parts.join('/');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Moving between pages slides the content softly (Bilal, 3 Nov 2026; styles.scss). A query-only change (a filter,
    // a tab) does not animate.
    provideRouter(routes, withComponentInputBinding(), withViewTransitions({
      skipInitialTransition: true,
      onViewTransitionCreated: ({ transition, from, to }) => {
        if (pathOf(from) === pathOf(to)) {
          transition.skipTransition();
        }
      },
    })),
    provideAppInitializer(scrollToTopOnNewPage),
    // Laravel Sanctum SPA auth: send the XSRF-TOKEN cookie back as X-XSRF-TOKEN.
    provideHttpClient(withFetch(), withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }), withInterceptors([apiInterceptor])),
    provideAppInitializer(registerIcons),
    // Know who is logged in before the first route renders (a failure just means "logged out").
    provideAppInitializer(() => inject(AuthService).ensureLoaded().then(() => undefined, () => undefined)),
  ],
};
