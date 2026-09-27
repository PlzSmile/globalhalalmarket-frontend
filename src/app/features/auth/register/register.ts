import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../../core/auth/auth.service';
import { applyServerErrors, clearServerErrors, serverError } from '../../../shared/forms/server-errors';
import { PASSWORD_MIN, matchesField } from '../../../shared/forms/validators';

@Component({
  selector: 'hs-register',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule],
  templateUrl: './register.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly passwordMin = PASSWORD_MIN;
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN)]],
    password_confirmation: ['', [Validators.required, matchesField('password')]],
    company_name: ['', [Validators.required, Validators.maxLength(120)]],
  });
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly serverError = serverError;

  constructor() {
    this.form.controls.password.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.form.controls.password_confirmation.updateValueAndValidity({ emitEvent: false }));
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
      await this.auth.register(this.form.getRawValue());
      await this.router.navigateByUrl('/verify-email');
    } catch (error) {
      this.formError.set(applyServerErrors(this.form, error));
    } finally {
      this.busy.set(false);
    }
  }
}
