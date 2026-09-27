import { Routes } from '@angular/router';
import { Shell } from './layout/shell/shell';
import { authGuard } from './core/auth/guards';

export const routes: Routes = [
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
