import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { registerIcons } from './core/icons/icons';
import { apiInterceptor } from './core/http/api.interceptor';
import { AuthService } from './core/auth/auth.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    // Laravel Sanctum SPA auth: send the XSRF-TOKEN cookie back as X-XSRF-TOKEN.
    provideHttpClient(withFetch(), withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }), withInterceptors([apiInterceptor])),
    provideAppInitializer(registerIcons),
    // Know who is logged in before the first route renders (a failure just means "logged out").
    provideAppInitializer(() => inject(AuthService).ensureLoaded().then(() => undefined, () => undefined)),
  ],
};
