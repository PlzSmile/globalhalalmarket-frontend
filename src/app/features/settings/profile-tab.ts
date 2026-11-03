import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth/auth.service';
import { MeApi } from '../../core/api/me-api';
import { ROLE_LABELS, TwoFactorStatus } from '../../core/models/auth';
import { applyServerErrors, clearServerErrors, serverError } from '../../shared/forms/server-errors';
import { PASSWORD_MIN, matchesField } from '../../shared/forms/validators';
import { EmailCodeDialog } from './email-code-dialog';
import { TwoFactorDialog, TwoFactorDialogMode } from './two-factor-dialog';

/** How long a confirmed email code allows profile changes (the server checks the same 15 minutes). */
const UNLOCK_MS = 15 * 60_000;

/**
 * Settings → Profile. 3 Nov 2026 (Bilal): one form for the profile (name, company name, with the email and role shown),
 * read-only until a code sent to the user's email confirms it's them; then one Update button saves it. Below: two-step
 * log-in (authenticator app or email codes) and the password.
 */
@Component({
  selector: 'hs-profile-tab',
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <div class="settings-grid">
      <mat-card appearance="outlined" class="hs-card">
        <mat-card-header><mat-card-title>Profile</mat-card-title></mat-card-header>
        <mat-card-content>
          @if (unlocked()) {
            <p class="lock lock--open" role="status"><mat-icon svgIcon="check" aria-hidden="true" />Confirmed: you can edit your profile until {{ unlockedUntilText() }}.</p>
          } @else {
            <p class="lock"><mat-icon svgIcon="lock" aria-hidden="true" />Read-only. To change it, we email you a code first.</p>
          }
          <form class="settings-form profile-form" [formGroup]="profile" (ngSubmit)="saveProfile()" novalidate>
            <mat-form-field appearance="outline">
              <mat-label>Name</mat-label>
              <input matInput formControlName="name" autocomplete="name" required [readonly]="!unlocked()" data-test="profile-name" />
              @if (profile.controls.name.hasError('required')) { <mat-error>Enter your name.</mat-error> }
              @else if (serverError(profile.controls.name); as message) { <mat-error>{{ message }}</mat-error> }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput [value]="auth.user()?.email ?? ''" readonly />
            </mat-form-field>
            @if (auth.canManageTeam()) {
              <mat-form-field appearance="outline">
                <mat-label>Company name</mat-label>
                <input matInput formControlName="company" autocomplete="organization" required [readonly]="!unlocked()" data-test="profile-company" />
                @if (profile.controls.company.hasError('required')) { <mat-error>Enter the company name.</mat-error> }
                @else if (serverError(profile.controls.company); as message) { <mat-error>{{ message }}</mat-error> }
              </mat-form-field>
            }
            <mat-form-field appearance="outline">
              <mat-label>Role</mat-label>
              <input matInput [value]="roleLabel()" readonly />
            </mat-form-field>
            @if (unlocked()) {
              <button mat-flat-button type="submit" [disabled]="savingProfile()" data-test="profile-update">Update</button>
            } @else {
              <button mat-flat-button type="button" (click)="unlock()" data-test="profile-edit"><mat-icon svgIcon="mail" /> Edit profile</button>
            }
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined" class="hs-card" data-test="two-factor-card">
        <mat-card-header><mat-card-title>Two-step log-in</mat-card-title></mat-card-header>
        <mat-card-content class="tf">
          @let tf = twoFactor();
          @if (tf?.app) {
            <p><span class="pill pill--on">On</span> Log-in asks for a code from your <strong>authenticator app</strong>. Without your phone you can still get a code by email.</p>
            <p class="muted">{{ tf?.recovery_codes_left }} recovery codes left.</p>
            <div class="tf__actions">
              <button mat-stroked-button type="button" (click)="openTwoFactor('recovery')">New recovery codes</button>
              <button mat-stroked-button type="button" (click)="openTwoFactor('disable')" data-test="tf-off">Turn off the app</button>
            </div>
          } @else {
            <p><span class="pill">Email</span> Each log-in sends a 6-digit code to your email. For faster, safer log-ins use an authenticator app on your phone.</p>
            <div class="tf__actions"><button mat-flat-button type="button" (click)="openTwoFactor('setup')" data-test="tf-on"><mat-icon svgIcon="shield" /> Use an authenticator app</button></div>
          }
        </mat-card-content>
      </mat-card>

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
              @if (password.controls.password.hasError('required')) { <mat-error>Enter a new password.</mat-error> }
              @else if (password.controls.password.hasError('minlength')) { <mat-error>Use at least {{ passwordMin }} characters.</mat-error> }
              @else if (serverError(password.controls.password); as message) { <mat-error>{{ message }}</mat-error> }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Confirm new password</mat-label>
              <input matInput type="password" formControlName="password_confirmation" autocomplete="new-password" required />
              @if (password.controls.password_confirmation.hasError('required')) { <mat-error>Type the new password again.</mat-error> }
              @else if (password.controls.password_confirmation.hasError('mismatch')) { <mat-error>The passwords do not match.</mat-error> }
            </mat-form-field>
            <p class="muted">Other devices where you are logged in will be signed out.</p>
            <button mat-flat-button type="submit" [disabled]="savingPassword()">Change password</button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .lock { display: flex; align-items: center; gap: var(--space-2); margin: 0 0 var(--space-3); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md);
      background: var(--color-surface-muted); color: var(--color-text-muted); font-size: var(--text-sm); }
    .lock mat-icon { width: 16px; height: 16px; flex: none; }
    .lock--open { background: var(--color-success-bg); color: var(--color-success-fg); }
    .profile-form input[readonly] { color: var(--color-text-muted); cursor: default; }
    .tf { display: grid; gap: var(--space-3); }
    .tf p { margin: 0; }
    .tf__actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .pill { display: inline-block; margin-right: var(--space-1); padding: 0 var(--space-2); border-radius: var(--radius-pill); background: var(--color-surface-muted);
      font-size: var(--text-xs); font-weight: var(--weight-semibold); color: var(--color-text-muted); }
    .pill--on { background: var(--color-success-bg); color: var(--color-success-fg); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileTab {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(MeApi);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly passwordMin = PASSWORD_MIN;
  protected readonly serverError = serverError;
  protected readonly profile = this.fb.group({
    name: [this.auth.user()?.name ?? '', [Validators.required, Validators.maxLength(120)]],
    company: [this.auth.user()?.company.name ?? '', [Validators.required, Validators.maxLength(120)]],
  });
  protected readonly password = this.fb.group({
    current_password: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN)]],
    password_confirmation: ['', [Validators.required, matchesField('password')]],
  });
  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);

  /** Until when the emailed code allows changes (epoch ms). */
  protected readonly unlockedUntil = signal(0);
  private readonly now = signal(Date.now());
  protected readonly unlocked = computed(() => this.unlockedUntil() > this.now());
  protected readonly unlockedUntilText = computed(() => new Date(this.unlockedUntil()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  protected readonly roleLabel = computed(() => ROLE_LABELS[this.auth.user()?.role ?? 'member']);
  protected readonly twoFactor = signal<TwoFactorStatus | null>(null);

  constructor() {
    const destroyRef = inject(DestroyRef);
    const tick = setInterval(() => this.now.set(Date.now()), 15_000);
    destroyRef.onDestroy(() => clearInterval(tick));
    this.password.controls.password.valueChanges
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => this.password.controls.password_confirmation.updateValueAndValidity({ emitEvent: false }));
    void this.loadTwoFactor();
  }

  /** "Edit profile": a code goes to the email; once confirmed the fields can be changed for 15 minutes. */
  async unlock(): Promise<void> {
    const ok = await firstValueFrom(this.dialog.open(EmailCodeDialog, { width: '440px', maxWidth: 'calc(100vw - 32px)', autoFocus: false }).afterClosed());
    if (ok) {
      this.now.set(Date.now());
      this.unlockedUntil.set(Date.now() + UNLOCK_MS);
      this.snackBar.open('Confirmed. You can now edit your profile.', 'Close', { duration: 4000 });
    }
  }

  /** One Update button saves the name and (owners and admins) the company name. */
  async saveProfile(): Promise<void> {
    clearServerErrors(this.profile);
    const canCompany = this.auth.canManageTeam();
    if (this.profile.controls.name.invalid || (canCompany && this.profile.controls.company.invalid)) {
      this.profile.markAllAsTouched();
      return;
    }
    this.savingProfile.set(true);
    try {
      const { name, company } = this.profile.getRawValue();
      let user = this.auth.user();
      if (user && name !== user.name) {
        user = await firstValueFrom(this.api.updateProfile(name));
      }
      if (user && canCompany && company !== user.company.name) {
        user = { ...user, company: await firstValueFrom(this.api.updateCompany(company)) };
      }
      if (user) this.auth.setUser(user);
      this.snackBar.open('Your profile is updated.', 'Close', { duration: 4000 });
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.error?.code === 'profile_locked') {
        this.unlockedUntil.set(0); // the 15 minutes ran out on the server
        this.snackBar.open('Please confirm a new code from your email first.', 'Close', { duration: 6000 });
      } else {
        applyServerErrors(this.profile, error);
      }
    } finally {
      this.savingProfile.set(false);
    }
  }

  protected async openTwoFactor(mode: TwoFactorDialogMode): Promise<void> {
    const ref = this.dialog.open(TwoFactorDialog, { data: mode, width: '480px', maxWidth: 'calc(100vw - 32px)', autoFocus: false, disableClose: mode === 'setup' });
    if (await firstValueFrom(ref.afterClosed())) {
      const done = mode === 'disable' ? 'The authenticator app is off. Log-in codes come by email.' : mode === 'setup' ? 'The authenticator app is on.' : 'New recovery codes saved.';
      this.snackBar.open(done, 'Close', { duration: 5000 });
      await this.loadTwoFactor();
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

  private async loadTwoFactor(): Promise<void> {
    try {
      this.twoFactor.set(await firstValueFrom(this.api.twoFactor()));
    } catch {
      this.twoFactor.set(null);
    }
  }
}
