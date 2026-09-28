import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthApi } from '../../../core/api/auth-api';
import { applyServerErrorsOr, clearServerErrors, serverError } from '../../../shared/forms/server-errors';
import { PASSWORD_MIN, matchesField } from '../../../shared/forms/validators';

@Component({
  selector: 'hs-reset-password',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressBarModule],
  template: `
    <h1 class="auth-title">Choose a new password</h1>
    <p class="auth-subtitle">For {{ email || 'your account' }}.</p>

    @if (formError(); as message) {
      <p class="notice notice--error" role="alert">{{ message }} <a routerLink="/forgot-password">Request a new link</a>.</p>
    }

    <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-form-field appearance="outline">
        <mat-label>New password</mat-label>
        <input matInput type="password" formControlName="password" autocomplete="new-password" required />
        <mat-hint>At least {{ passwordMin }} characters.</mat-hint>
        @if (form.controls.password.hasError('required')) { <mat-error>Choose a password.</mat-error> }
        @else if (form.controls.password.hasError('minlength')) { <mat-error>Use at least {{ passwordMin }} characters.</mat-error> }
        @else if (serverError(form.controls.password); as message) { <mat-error>{{ message }}</mat-error> }
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Confirm new password</mat-label>
        <input matInput type="password" formControlName="password_confirmation" autocomplete="new-password" required />
        @if (form.controls.password_confirmation.hasError('mismatch')) { <mat-error>The passwords do not match.</mat-error> }
        @else if (form.controls.password_confirmation.hasError('required')) { <mat-error>Type your password again.</mat-error> }
      </mat-form-field>
      <button mat-flat-button class="auth-submit" type="submit" [disabled]="busy()">Change password</button>
      @if (busy()) { <mat-progress-bar mode="indeterminate" aria-label="Saving" /> }
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPassword {
  private readonly api = inject(AuthApi);
  private readonly router = inject(Router);
  private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;

  protected readonly passwordMin = PASSWORD_MIN;
  protected readonly serverError = serverError;
  protected readonly email = this.params.get('email') ?? '';
  private readonly token = this.params.get('token') ?? '';
  protected readonly form = inject(NonNullableFormBuilder).group({
    password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN)]],
    password_confirmation: ['', [Validators.required, matchesField('password')]],
  });
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);

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
      await firstValueFrom(this.api.resetPassword({ token: this.token, email: this.email, ...this.form.getRawValue() }));
      await this.router.navigateByUrl('/login?reset=1');
    } catch (error) {
      // Token/email problems come back on "email", which has no field here → show them above the form.
      this.formError.set(applyServerErrorsOr(this.form, error, 'This reset link is not valid or has expired.'));
    } finally {
      this.busy.set(false);
    }
  }
}
