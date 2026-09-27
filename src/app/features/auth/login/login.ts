import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../../core/auth/auth.service';
import { safeReturnUrl } from '../../../core/auth/return-url';
import { applyServerErrors, serverError } from '../../../shared/forms/server-errors';

const NOTICES: Record<string, string> = {
  verified: 'Your email is verified. Please log in.',
  invalid: 'That verification link is not valid. Log in to request a new one.',
  reset: 'Your password has been changed. Please log in.',
};

@Component({
  selector: 'hs-login',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthService);
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

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.formError.set(null);
    try {
      const user = await this.auth.login(this.form.getRawValue());
      await this.router.navigateByUrl(user.email_verified ? safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')) : '/verify-email');
    } catch (error) {
      this.formError.set(applyServerErrors(this.form, error));
    } finally {
      this.busy.set(false);
    }
  }
}
