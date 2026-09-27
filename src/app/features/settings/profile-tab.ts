import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth/auth.service';
import { MeApi } from '../../core/api/me-api';
import { applyServerErrors, clearServerErrors, serverError } from '../../shared/forms/server-errors';
import { PASSWORD_MIN, matchesField } from '../../shared/forms/validators';

@Component({
  selector: 'hs-profile-tab',
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="settings-grid">
      <mat-card appearance="outlined" class="hs-card">
        <mat-card-header><mat-card-title>Your details</mat-card-title></mat-card-header>
        <mat-card-content>
          <form class="settings-form" [formGroup]="profile" (ngSubmit)="saveProfile()" novalidate>
            <mat-form-field appearance="outline">
              <mat-label>Name</mat-label>
              <input matInput formControlName="name" autocomplete="name" required />
              @if (profile.controls.name.hasError('required')) { <mat-error>Enter your name.</mat-error> }
              @else if (serverError(profile.controls.name); as message) { <mat-error>{{ message }}</mat-error> }
            </mat-form-field>
            <p class="muted">Email: {{ auth.user()?.email }}</p>
            <button mat-flat-button type="submit" [disabled]="savingProfile()">Save</button>
          </form>
        </mat-card-content>
      </mat-card>

      @if (auth.canManageTeam()) {
        <mat-card appearance="outlined" class="hs-card">
          <mat-card-header><mat-card-title>Company</mat-card-title></mat-card-header>
          <mat-card-content>
            <form class="settings-form" [formGroup]="company" (ngSubmit)="saveCompany()" novalidate>
              <mat-form-field appearance="outline">
                <mat-label>Company name</mat-label>
                <input matInput formControlName="name" autocomplete="organization" required />
                @if (company.controls.name.hasError('required')) { <mat-error>Enter the company name.</mat-error> }
                @else if (serverError(company.controls.name); as message) { <mat-error>{{ message }}</mat-error> }
              </mat-form-field>
              <button mat-flat-button type="submit" [disabled]="savingCompany()">Save</button>
            </form>
          </mat-card-content>
        </mat-card>
      }

      <mat-card appearance="outlined" class="hs-card">
        <mat-card-header><mat-card-title>Change password</mat-card-title></mat-card-header>
        <mat-card-content>
          <form class="settings-form" [formGroup]="password" (ngSubmit)="changePassword()" novalidate>
            <mat-form-field appearance="outline">
              <mat-label>Current password</mat-label>
              <input matInput type="password" formControlName="current_password" autocomplete="current-password" required />
              @if (password.controls.current_password.hasError('required')) { <mat-error>Enter your current password.</mat-error> }
              @else if (serverError(password.controls.current_password); as message) { <mat-error>{{ message }}</mat-error> }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>New password</mat-label>
              <input matInput type="password" formControlName="password" autocomplete="new-password" required />
              <mat-hint>At least {{ passwordMin }} characters.</mat-hint>
              @if (password.controls.password.hasError('minlength')) { <mat-error>Use at least {{ passwordMin }} characters.</mat-error> }
              @else if (serverError(password.controls.password); as message) { <mat-error>{{ message }}</mat-error> }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Confirm new password</mat-label>
              <input matInput type="password" formControlName="password_confirmation" autocomplete="new-password" required />
              @if (password.controls.password_confirmation.hasError('mismatch')) { <mat-error>The passwords do not match.</mat-error> }
            </mat-form-field>
            <p class="muted">Other devices where you are logged in will be signed out.</p>
            <button mat-flat-button type="submit" [disabled]="savingPassword()">Change password</button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileTab {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(MeApi);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly passwordMin = PASSWORD_MIN;
  protected readonly serverError = serverError;
  protected readonly profile = this.fb.group({ name: [this.auth.user()?.name ?? '', [Validators.required, Validators.maxLength(120)]] });
  protected readonly company = this.fb.group({ name: [this.auth.user()?.company.name ?? '', [Validators.required, Validators.maxLength(120)]] });
  protected readonly password = this.fb.group({
    current_password: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN)]],
    password_confirmation: ['', [Validators.required, matchesField('password')]],
  });
  protected readonly savingProfile = signal(false);
  protected readonly savingCompany = signal(false);
  protected readonly savingPassword = signal(false);

  constructor() {
    this.password.controls.password.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.password.controls.password_confirmation.updateValueAndValidity({ emitEvent: false }));
  }

  async saveProfile(): Promise<void> {
    clearServerErrors(this.profile);
    if (this.profile.invalid) return this.profile.markAllAsTouched();
    this.savingProfile.set(true);
    try {
      this.auth.setUser(await firstValueFrom(this.api.updateProfile(this.profile.getRawValue().name)));
      this.snackBar.open('Your details are saved.', 'Close', { duration: 4000 });
    } catch (error) {
      applyServerErrors(this.profile, error);
    } finally {
      this.savingProfile.set(false);
    }
  }

  async saveCompany(): Promise<void> {
    clearServerErrors(this.company);
    if (this.company.invalid) return this.company.markAllAsTouched();
    this.savingCompany.set(true);
    try {
      const updated = await firstValueFrom(this.api.updateCompany(this.company.getRawValue().name));
      const user = this.auth.user();
      if (user) this.auth.setUser({ ...user, company: updated });
      this.snackBar.open('Company name saved.', 'Close', { duration: 4000 });
    } catch (error) {
      applyServerErrors(this.company, error);
    } finally {
      this.savingCompany.set(false);
    }
  }

  async changePassword(): Promise<void> {
    clearServerErrors(this.password);
    if (this.password.invalid) return this.password.markAllAsTouched();
    this.savingPassword.set(true);
    try {
      await firstValueFrom(this.api.changePassword(this.password.getRawValue()));
      this.password.reset();
      this.snackBar.open('Password changed.', 'Close', { duration: 4000 });
    } catch (error) {
      applyServerErrors(this.password, error);
    } finally {
      this.savingPassword.set(false);
    }
  }
}
