import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { MeApi } from '../../core/api/me-api';
import { CompanyDetail } from '../../core/models/auth';
import { Logo } from '../../shared/ui/logo';
import { BrandingForm } from '../settings/branding-form';
import { TwoFactorDialog, TwoFactorDialogMode } from '../settings/two-factor-dialog';

export type SetupStep = 'security' | 'company' | 'finish';

export const SETUP_STEPS: readonly { readonly key: SetupStep | 'email'; readonly label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'security', label: 'Security' },
  { key: 'company', label: 'Your company' },
  { key: 'finish', label: 'Finish' },
];

/**
 * First-run setup for a new sign-up (Bilal, 12 Nov 2026), before the dashboard: the email is already confirmed with a
 * code; then the authenticator app (required), the company's own details and logo (what suppliers will see), and
 * a short "You are all set" (Bilal, 12 Nov 2026: no email preview here).
 */
@Component({
  selector: 'hs-setup-wizard',
  imports: [MatButtonModule, MatIconModule, Logo, BrandingForm],
  template: `
    <main class="setup" id="app-main" tabindex="-1">
      <header class="setup__top">
        <hs-logo />
        <button mat-button type="button" (click)="logout()"><mat-icon svgIcon="logout" /> Log out</button>
      </header>

      <section class="setup__card" aria-labelledby="setup-title">
        <h1 id="setup-title" class="setup__title">Set up your account</h1>
        <p class="setup__lead">A few steps so your suppliers see your company, not ours.</p>

        <ol class="steps" aria-label="Setup steps">
          @for (s of steps; track s.key; let i = $index) {
            <li class="steps__item" [class.steps__item--done]="i < index()" [class.steps__item--current]="i === index()"
                [attr.aria-current]="i === index() ? 'step' : null">
              <span class="steps__dot">@if (i < index()) { <mat-icon svgIcon="check" /> } @else { {{ i + 1 }} }</span>
              <span class="steps__label">{{ s.label }}</span>
            </li>
          }
        </ol>

        @switch (step()) {
          @case ('security') {
            <h2 class="setup__h2">Protect your account with an authenticator app</h2>
            <p>Each time you log in, you will type a 6-digit code from an app on your phone, such as Google Authenticator,
              Microsoft Authenticator or 1Password. Your certificates and supplier details stay safe even if someone learns your password.</p>
            @if (twoFactorOn()) {
              <p class="notice notice--success" role="status"><mat-icon svgIcon="check" /> The authenticator app is on.</p>
              <button mat-flat-button type="button" class="setup__next" (click)="step.set('company')">Continue</button>
            } @else {
              <button mat-flat-button type="button" class="setup__next" (click)="setUpTwoFactor()"><mat-icon svgIcon="shield" /> Set up the authenticator app</button>
            }
          }
          @case ('company') {
            <h2 class="setup__h2">Your company</h2>
            <p>Your suppliers see this on every request, reminder and upload page, and on your audit packs.</p>
            <hs-branding-form mode="setup" (saved)="companySaved($event)" />
            <button mat-button type="button" class="setup__back" (click)="step.set('security')">Back</button>
          }
          @case ('finish') {
            <h2 class="setup__h2">You are all set</h2>
            <p>Your suppliers will see {{ company()?.name || 'your company' }} on every request, reminder and upload page.</p>
            @if (error(); as message) { <p class="notice notice--error" role="alert">{{ message }}</p> }
            <div class="setup__actions">
              <button mat-flat-button type="button" class="setup__next" (click)="finish()" [disabled]="finishing()">Go to my dashboard</button>
              <button mat-button type="button" (click)="step.set('company')">Back</button>
            </div>
            <p class="setup__hint">You can change these details any time in Settings → Branding.</p>
          }
        }
      </section>
    </main>
  `,
  styles: `
    .setup { min-height: 100dvh; display: grid; align-content: start; justify-items: center; gap: var(--space-4);
      padding: var(--space-4) var(--gutter) var(--space-10); background: var(--color-bg); }
    .setup__top, .setup__card { box-sizing: border-box; width: min(100%, 36rem); }
    .setup__top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
    .setup__card { display: grid; gap: var(--space-3); padding: var(--space-5) var(--space-4); background: var(--color-surface);
      border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-md); }
    .setup__card p { margin: 0; line-height: 1.55; }
    .setup__title { margin: 0; font-size: var(--text-2xl); }
    .setup__lead { color: var(--color-text-muted); }
    .setup__h2 { margin: var(--space-2) 0 0; font-size: var(--text-lg); }
    .setup__next { justify-self: start; min-height: var(--touch-target); }
    .setup__back { justify-self: start; }
    .setup__actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
    .setup__hint { font-size: var(--text-sm); color: var(--color-text-muted); }
    .notice { display: flex; align-items: center; gap: var(--space-2); margin: 0; }
    .notice mat-icon { width: 18px; height: 18px; }

    .steps { list-style: none; margin: 0 0 var(--space-2); padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-2); }
    .steps__item { display: grid; justify-items: center; gap: var(--space-1); text-align: center; color: var(--color-text-muted); font-size: var(--text-sm); }
    .steps__dot { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--color-border-strong);
      background: var(--color-surface); font-weight: var(--weight-semibold); }
    .steps__dot mat-icon { width: 18px; height: 18px; }
    .steps__item--done .steps__dot { border-color: var(--color-primary); background: var(--color-primary); color: var(--color-primary-contrast); }
    .steps__item--current { color: var(--color-text); font-weight: var(--weight-semibold); }
    .steps__item--current .steps__dot { border-color: var(--color-primary); color: var(--color-primary); }


    @media (min-width: 768px) {
      .setup { align-content: center; }
      .setup__card { padding: var(--space-6) var(--space-8); }
    }
    @media (max-width: 767px) {
      .setup__next { justify-self: stretch; }
      .steps__label { font-size: var(--text-sm); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupWizard {
  private readonly auth = inject(AuthService);
  private readonly api = inject(MeApi);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly steps = SETUP_STEPS;
  protected readonly twoFactorOn = signal(this.auth.user()?.two_factor_enabled === true);
  readonly step = signal<SetupStep>(this.twoFactorOn() ? 'company' : 'security');
  protected readonly index = computed(() => SETUP_STEPS.findIndex((s) => s.key === this.step()));
  protected readonly company = signal<CompanyDetail | null>(null);
  protected readonly finishing = signal(false);
  protected readonly error = signal<string | null>(null);

  async setUpTwoFactor(): Promise<void> {
    const mode: TwoFactorDialogMode = 'setup';
    const ref = this.dialog.open(TwoFactorDialog, { data: mode, width: '480px', maxWidth: 'calc(100vw - 32px)', autoFocus: false, disableClose: true });
    if (await firstValueFrom(ref.afterClosed())) {
      this.twoFactorOn.set(true);
      await this.auth.refresh().catch(() => null);
      this.step.set('company');
    }
  }

  companySaved(company: CompanyDetail): void {
    this.company.set(company);
    this.step.set('finish');
  }

  async finish(): Promise<void> {
    this.error.set(null);
    this.finishing.set(true);
    try {
      await firstValueFrom(this.api.completeSetup());
      await this.auth.refresh();
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.error?.code === 'two_factor_required') {
        this.twoFactorOn.set(false);
        this.step.set('security');
      } else {
        this.error.set('We could not finish the setup just now. Please try again.');
      }
    } finally {
      this.finishing.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout().catch(() => undefined);
    await this.router.navigateByUrl('/login');
  }
}
