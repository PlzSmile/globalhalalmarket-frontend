import { Routes } from '@angular/router';
import { Shell } from './layout/shell/shell';
import { AuthLayout } from './layout/auth-layout/auth-layout';
import { authGuard, guestGuard } from './core/auth/guards';

export const routes: Routes = [
  {
    // Login, sign-up, password and invitation screens (matched before the Shell's catch-all).
    path: '',
    component: AuthLayout,
    children: [
      { path: 'login', title: 'Log in · HalalSecure', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login/login').then((m) => m.Login) },
      { path: 'register', title: 'Create account · HalalSecure', canActivate: [guestGuard], loadComponent: () => import('./features/auth/register/register').then((m) => m.Register) },
    ],
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', title: 'Dashboard · HalalSecure', loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard) },
      ...(['products', 'suppliers', 'certificates', 'settings'] as const).map((path) => ({
        path,
        title: `${path[0].toUpperCase()}${path.slice(1)} · HalalSecure`,
        data: { title: `${path[0].toUpperCase()}${path.slice(1)}` },
        loadComponent: () => import('./features/coming-soon/coming-soon').then((m) => m.ComingSoon),
      })),
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
