import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthApi } from '../../../core/api/auth-api';
import { AuthService } from '../../../core/auth/auth.service';
import { applyServerErrors, clearServerErrors, serverError } from '../../../shared/forms/server-errors';

const COOLDOWN_SECONDS = 30;

/**
 * Step 1 after sign-up (12 Nov 2026, Bilal: verify the email by code): type the 6-digit code we emailed. A correct code
 * goes on to the setup wizard (new owners) or the dashboard.
 */
@Component({
  selector: 'hs-verify-email',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <h1 class="auth-title">Check your inbox</h1>
    <p class="auth-subtitle">We sent a 6-digit code to <strong>{{ auth.user()?.email }}</strong>. Type it below to confirm your email.</p>

    @if (message(); as text) { <p class="notice notice--info" role="status">{{ text }}</p> }

    <form class="auth-form" [formGroup]="form" (ngSubmit)="verify()" novalidate>
      <mat-form-field appearance="outline">
        <mat-label>Code from the email</mat-label>
        <input matInput formControlName="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required />
        @if (form.controls.code.hasError('required')) { <mat-error>Enter the 6-digit code.</mat-error> }
        @else if (form.controls.code.hasError('pattern')) { <mat-error>The code has 6 digits.</mat-error> }
        @else if (serverError(form.controls.code); as text) { <mat-error>{{ text }}</mat-error> }
      </mat-form-field>
      <button mat-flat-button class="auth-submit" type="submit" [disabled]="busy()">Confirm email</button>
      <button mat-stroked-button class="auth-submit" type="button" (click)="resend()" [disabled]="cooldown() > 0">
        {{ cooldown() > 0 ? 'Send a new code in ' + cooldown() + ' s' : 'Send a new code' }}
      </button>
      <button mat-button class="auth-submit" type="button" (click)="logout()">
        <mat-icon svgIcon="logout" /> Log out
      </button>
    </form>
    <p class="auth-footer">No email? Check your spam folder. The code works for 10 minutes.</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmail {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);
  protected readonly serverError = serverError;

  protected readonly form = inject(NonNullableFormBuilder).group({
    code: ['', [Validators.required, Validators.pattern(/^\s*\d{3}\s?\d{3}\s*$/)]],
  });
  protected readonly busy = signal(false);
  protected readonly cooldown = signal(0);
  protected readonly message = signal<string | null>(null);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
    this.startCooldown(COOLDOWN_SECONDS); // the sign-up just sent a code
  }

  async verify(): Promise<void> {
    clearServerErrors(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    try {
      const user = this.auth.setUser(await firstValueFrom(this.api.verifyEmailCode(this.form.getRawValue().code.replace(/\s+/g, ''))));
      await this.router.navigateByUrl(user.setup_required ? '/setup' : '/dashboard');
    } catch (error) {
      applyServerErrors(this.form, error);
    } finally {
      this.busy.set(false);
    }
  }

  async resend(): Promise<void> {
    try {
      const sent = await firstValueFrom(this.api.resendVerification());
      this.message.set('A new code is on its way. It can take a minute to arrive.');
      this.startCooldown(sent?.resend_after ?? COOLDOWN_SECONDS);
    } catch (error) {
      const wait = error instanceof HttpErrorResponse ? Number(error.error?.resend_after ?? 0) : 0;
      if (wait > 0) {
        this.startCooldown(wait);
      } else {
        this.message.set('We could not send the email just now. Please try again in a minute.');
      }
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout().catch(() => undefined);
    await this.router.navigateByUrl('/login');
  }

  private startCooldown(seconds: number): void {
    this.cooldown.set(seconds);
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.cooldown.update((s) => s - 1);
      if (this.cooldown() <= 0) clearInterval(this.timer);
    }, 1000);
  }
}
