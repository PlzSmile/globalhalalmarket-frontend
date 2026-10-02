import { Routes } from '@angular/router';
import { Shell } from './layout/shell/shell';
import { AuthLayout } from './layout/auth-layout/auth-layout';
import { authGuard, guestGuard, unverifiedGuard } from './core/auth/guards';

export const routes: Routes = [
  {
    // Login, sign-up, password and invitation screens (matched before the Shell's catch-all).
    path: '',
    component: AuthLayout,
    children: [
      { path: 'login', title: 'Log in · Global Halal Market', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login/login').then((m) => m.Login) },
      { path: 'register', title: 'Create account · Global Halal Market', canActivate: [guestGuard], loadComponent: () => import('./features/auth/register/register').then((m) => m.Register) },
      { path: 'forgot-password', title: 'Forgot password · Global Halal Market', canActivate: [guestGuard], loadComponent: () => import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword) },
      { path: 'reset-password', title: 'New password · Global Halal Market', canActivate: [guestGuard], loadComponent: () => import('./features/auth/reset-password/reset-password').then((m) => m.ResetPassword) },
      { path: 'verify-email', title: 'Verify your email · Global Halal Market', canActivate: [unverifiedGuard], loadComponent: () => import('./features/auth/verify-email/verify-email').then((m) => m.VerifyEmail) },
      { path: 'invitation/:token', title: 'Accept invitation · Global Halal Market', loadComponent: () => import('./features/auth/accept-invitation/accept-invitation').then((m) => m.AcceptInvitation) },
    ],
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', title: 'Dashboard · Global Halal Market', loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard) },
      { path: 'settings', title: 'Settings · Global Halal Market', loadComponent: () => import('./features/settings/settings').then((m) => m.Settings) },
      { path: 'products', title: 'Products · Global Halal Market', loadComponent: () => import('./features/products/products-list').then((m) => m.ProductsList) },
      { path: 'products/:id', title: 'Product · Global Halal Market', loadComponent: () => import('./features/products/product-detail').then((m) => m.ProductDetailPage) },
      { path: 'suppliers', title: 'Suppliers · Global Halal Market', loadComponent: () => import('./features/suppliers/suppliers-list').then((m) => m.SuppliersList) },
      { path: 'suppliers/:id', title: 'Supplier · Global Halal Market', loadComponent: () => import('./features/suppliers/supplier-detail').then((m) => m.SupplierDetailPage) },
      { path: 'import', title: 'Import · Global Halal Market', loadComponent: () => import('./features/import/catalogue-import').then((m) => m.CatalogueImport) },
      { path: 'certificates', title: 'Certificates · Global Halal Market', loadComponent: () => import('./features/certificates/certificates-list').then((m) => m.CertificatesList) },
      { path: 'certificates/:id', title: 'Certificate · Global Halal Market', loadComponent: () => import('./features/certificates/certificate-detail').then((m) => m.CertificateDetailPage) },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
