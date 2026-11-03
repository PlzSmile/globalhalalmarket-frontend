import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthApi } from '../../../core/api/auth-api';
import { AuthService } from '../../../core/auth/auth.service';
import { safeReturnUrl } from '../../../core/auth/return-url';
import { LoginChallenge, LoginCodeMethod } from '../../../core/models/auth';
import { applyServerErrors, clearServerErrors, serverError } from '../../../shared/forms/server-errors';
import { errorMessage } from '../../../shared/forms/error-message';
import { Loader } from '../../../shared/ui/loader';
import { OtpInput } from '../../../shared/ui/otp-input';

const NOTICES: Record<string, string> = {
  verified: 'Your email is verified. Please log in.',
  invalid: 'That verification link is not valid. Log in to request a new one.',
  reset: 'Your password has been changed. Please log in.',
};

/**
 * Log in. Step 1: email and password. Step 2 (3 Nov 2026, like the admin panel): a code from the authenticator app
 * when the user turned it on, else a 6-digit code we email. The code checks itself once all six digits are in.
 */
@Component({
  selector: 'hs-login',
  imports: [Loader, OtpInput, ReactiveFormsModule, RouterLink, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './login.html',
  styles: `
    .code { display: grid; gap: var(--space-4); }
    .code__icon { display: grid; place-items: center; width: 3rem; height: 3rem; border-radius: 50%; background: var(--color-primary-soft); color: var(--color-primary); }
    .code__icon mat-icon { width: 24px; height: 24px; }
    .code__help { margin: 0; color: var(--color-text-muted); font-size: var(--text-sm); }
    .code__links { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-1) var(--space-3); }
    .code__links button { min-height: var(--touch-target); }
    .recovery { width: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    remember: [false],
  });
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly serverError = serverError;
  protected readonly notice = computed(() => {
    const params = this.route.snapshot.queryParamMap;
    if (params.get('reset') === '1') return NOTICES['reset'];
    const verified = params.get('verified');
    return verified === '1' ? NOTICES['verified'] : verified === 'invalid' ? NOTICES['invalid'] : null;
  });

  /** Step 2: which code we wait for (null = still on the password step). */
  protected readonly challenge = signal<LoginChallenge | null>(null);
  protected readonly method = signal<LoginCodeMethod>('email');
  protected readonly code = signal('');
  protected readonly codeError = signal<string | null>(null);
  protected readonly codeWrong = signal(false);
  protected readonly codeInfo = signal<string | null>(null);
  protected readonly resendIn = signal(0);
  protected readonly recovery = new FormControl('', { nonNullable: true });
  private readonly otp = viewChild(OtpInput);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  async submit(): Promise<void> {
    clearServerErrors(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.formError.set(null);
    try {
      const challenge = await this.auth.login(this.form.getRawValue());
      this.challenge.set(challenge);
      this.method.set(challenge.method);
      this.codeInfo.set(null);
      this.startResendTimer(challenge.resend_after);
      setTimeout(() => this.otp()?.focus());
    } catch (error) {
      this.formError.set(applyServerErrors(this.form, error));
    } finally {
      this.busy.set(false);
    }
  }

  /** Called by the boxes when all six digits are in, by the Verify button, and for a recovery code. */
  async verify(code = this.method() === 'recovery' ? this.recovery.value : this.code()): Promise<void> {
    if (this.busy() || !code.trim()) {
      return;
    }
    this.busy.set(true);
    this.codeError.set(null);
    this.codeWrong.set(false);
    try {
      const user = await this.auth.verifyLogin(code, this.method());
      await this.router.navigateByUrl(user.email_verified ? safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')) : '/verify-email');
    } catch (error) {
      const restart = error instanceof HttpErrorResponse ? error.error?.errors?.login?.[0] : undefined;
      if (typeof restart === 'string') {
        this.backToPassword(restart); // timed out, or too many wrong codes
        return;
      }
      this.codeError.set(errorMessage(error, 'That code did not work. Please try again.'));
      this.codeWrong.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  /** Send the code by email: again, or instead of the authenticator app. */
  async sendEmailCode(): Promise<void> {
    if (this.busy() || this.resendIn() > 0) {
      return;
    }
    this.busy.set(true);
    this.codeError.set(null);
    try {
      const sent = await firstValueFrom(this.api.loginEmailCode());
      this.method.set('email');
      this.codeInfo.set(`We sent a new code to ${sent.email_hint}.`);
      this.startResendTimer(sent.resend_after);
      this.otp()?.clear();
    } catch (error) {
      const wait = error instanceof HttpErrorResponse ? Number(error.error?.resend_after ?? 0) : 0;
      if (wait > 0) {
        this.startResendTimer(wait);
      } else {
        const restart = error instanceof HttpErrorResponse ? error.error?.errors?.login?.[0] : undefined;
        if (typeof restart === 'string') {
          this.backToPassword(restart);
          return;
        }
        this.codeError.set(errorMessage(error, 'The code could not be sent. Please try again.'));
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected useMethod(method: LoginCodeMethod): void {
    this.method.set(method);
    this.codeError.set(null);
    this.codeInfo.set(null);
    setTimeout(() => this.otp()?.focus());
  }

  protected backToPassword(message: string | null = null): void {
    this.challenge.set(null);
    this.code.set('');
    this.recovery.setValue('');
    this.form.controls.password.setValue('');
    this.formError.set(message);
    clearInterval(this.timer);
  }

  private startResendTimer(seconds: number): void {
    clearInterval(this.timer);
    this.resendIn.set(seconds);
    if (seconds <= 0) {
      return;
    }
    this.timer = setInterval(() => {
      const left = this.resendIn() - 1;
      this.resendIn.set(Math.max(0, left));
      if (left <= 0) {
        clearInterval(this.timer);
      }
    }, 1000);
  }
}
