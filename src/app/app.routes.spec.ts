import { Type } from '@angular/core';
import { routes } from './app.routes';
import { AuthLayout } from './layout/auth-layout/auth-layout';
import { Shell } from './layout/shell/shell';

/** The layouts are lazy routes; a broken loadComponent would show pages without their layout. */
describe('app routes', () => {
  async function layoutFor(childPath: string): Promise<Type<unknown> | undefined> {
    const parent = routes.find((route) => route.children?.some((child) => child.path === childPath));
    return (await parent?.loadComponent?.()) as Type<unknown> | undefined;
  }

  it('shows login, sign-up and password screens inside the auth layout', async () => {
    for (const path of ['login', 'register', 'forgot-password', 'reset-password', 'verify-email', 'invitation/:token']) {
      expect(await layoutFor(path)).toBe(AuthLayout);
    }
  });

  it('shows the tracker pages inside the shell', async () => {
    for (const path of ['dashboard', 'settings', 'products', 'suppliers', 'certificates']) {
      expect(await layoutFor(path)).toBe(Shell);
    }
  });
});
