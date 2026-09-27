import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthApi } from '../../../core/api/auth-api';
import { applyServerErrors, clearServerErrors, serverError } from '../../../shared/forms/server-errors';

@Component({
  selector: 'hs-forgot-password',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressBarModule],
  template: `
    <h1 class="auth-title">Forgot your password?</h1>
    <p class="auth-subtitle">Enter your email and we will send you a link to choose a new one.</p>

    @if (sent(); as message) {
      <p class="notice notice--success" role="status">{{ message }}</p>
    } @else {
      <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" required />
          @if (form.controls.email.hasError('required')) { <mat-error>Enter your email address.</mat-error> }
          @else if (form.controls.email.hasError('email')) { <mat-error>Enter a valid email address.</mat-error> }
          @else if (serverError(form.controls.email); as message) { <mat-error>{{ message }}</mat-error> }
        </mat-form-field>
        <button mat-flat-button class="auth-submit" type="submit" [disabled]="busy()">Send reset link</button>
        @if (busy()) { <mat-progress-bar mode="indeterminate" aria-label="Sending" /> }
      </form>
    }

    <p class="auth-footer"><a routerLink="/login">Back to log in</a></p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPassword {
  private readonly api = inject(AuthApi);

  protected readonly form = inject(NonNullableFormBuilder).group({ email: ['', [Validators.required, Validators.email]] });
  protected readonly busy = signal(false);
  protected readonly sent = signal<string | null>(null);
  protected readonly serverError = serverError;

  async submit(): Promise<void> {
    clearServerErrors(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    try {
      const { message } = await firstValueFrom(this.api.forgotPassword(this.form.getRawValue().email));
      this.sent.set(message);
    } catch (error) {
      applyServerErrors(this.form, error);
    } finally {
      this.busy.set(false);
    }
  }
}
