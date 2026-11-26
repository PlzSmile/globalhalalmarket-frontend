import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth/auth.service';
import { MeApi } from '../../core/api/me-api';
import { BrandingChange, CompanyDetail } from '../../core/models/auth';
import { applyServerErrors, clearServerErrors, serverError } from '../../shared/forms/server-errors';
import { EmailCodeDialog } from './email-code-dialog';

export const LOGO_MAX_BYTES = 1024 * 1024;
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Why a chosen logo file is refused before it is sent, or null when it may go up. */
export function logoProblem(file: { size: number; type: string }): string | null {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) return 'Please choose a PNG, JPG or WebP file.';
  if (file.size > LOGO_MAX_BYTES) return 'The logo can be at most 1 MB.';
  return null;
}

/**
 * The customer's own branding for suppliers (Bilal, 12 Nov 2026): company name, logo, reply-to email, phone, website
 * and address. Used in the setup wizard and in Settings → Branding. Bilal, 12 Nov 2026: no emailed code for any of it,
 * the reply-to email included (like Xero); a bar shows while the logo uploads.
 */
@Component({
  selector: 'hs-branding-form',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule],
  template: `
    <section class="logo" aria-labelledby="logo-title">
      <h3 id="logo-title" class="logo__title">Logo</h3>
      <div class="logo__row">
        <div class="logo__preview" [class.logo__preview--empty]="!logoUrl()">
          @if (logoUrl(); as url) { <img [src]="url" alt="Your logo" /> } @else { <span>{{ initials() }}</span> }
        </div>
        <div class="logo__actions">
          <input #file class="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" (change)="chooseLogo(file)" data-test="logo-input" />
          <button mat-stroked-button type="button" (click)="file.click()" [disabled]="uploading()">
            <mat-icon svgIcon="upload" /> {{ logoUrl() ? 'Change logo' : 'Upload logo' }}
          </button>
          @if (logoUrl()) { <button mat-button type="button" (click)="removeLogo()" [disabled]="uploading()">Remove</button> }
        </div>
      </div>
      @if (uploading()) {
        <div class="logo__progress" role="status" aria-live="polite">
          <mat-progress-bar mode="indeterminate" aria-label="Uploading the logo" />
          <span>{{ logoUrl() ? 'Working on your logo…' : 'Uploading your logo…' }}</span>
        </div>
      }
      <p class="hint">PNG, JPG or WebP, up to 1 MB. A wide logo on a plain background works best.</p>
      @if (logoError(); as message) { <p class="notice notice--error" role="alert">{{ message }}</p> }
    </section>

    <form class="fields" [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-form-field appearance="outline">
        <mat-label>Company name</mat-label>
        <input matInput formControlName="name" autocomplete="organization" required />
        @if (form.controls.name.hasError('required')) { <mat-error>Enter your company name.</mat-error> }
        @else if (serverError(form.controls.name); as message) { <mat-error>{{ message }}</mat-error> }
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Reply-to email for suppliers</mat-label>
        <input matInput type="email" formControlName="contact_email" autocomplete="email" [placeholder]="auth.user()?.email ?? ''" />
        <mat-hint>Suppliers' replies go here. Empty: to the person who sends the request.</mat-hint>
        @if (form.controls.contact_email.hasError('email')) { <mat-error>Enter a valid email address.</mat-error> }
        @else if (serverError(form.controls.contact_email); as message) { <mat-error>{{ message }}</mat-error> }
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Phone (optional)</mat-label>
        <input matInput type="tel" formControlName="phone" autocomplete="tel" />
        @if (serverError(form.controls.phone); as message) { <mat-error>{{ message }}</mat-error> }
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Website (optional)</mat-label>
        <input matInput type="url" formControlName="website" autocomplete="url" placeholder="https://" />
        @if (serverError(form.controls.website); as message) { <mat-error>{{ message }}</mat-error> }
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Address (optional)</mat-label>
        <textarea matInput formControlName="address" rows="2" autocomplete="street-address"></textarea>
        @if (serverError(form.controls.address); as message) { <mat-error>{{ message }}</mat-error> }
      </mat-form-field>
      <button mat-flat-button type="submit" class="fields__submit" [disabled]="saving() || loading()">{{ submitLabel() }}</button>
    </form>
  `,
  styles: `
    :host { display: grid; gap: var(--space-4); }
    .logo { display: grid; gap: var(--space-2); }
    .logo__title { margin: 0; font-size: var(--text-base); font-weight: var(--weight-semibold); }
    .logo__row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
    /* The whole logo always shows: the image fills the box and scales down to fit (12 Nov 2026: it was cut off). */
    .logo__preview { position: relative; width: min(100%, 18rem); height: 6rem; padding: var(--space-2); box-sizing: border-box; display: grid; place-items: center;
      border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-logo-backdrop, var(--color-surface)); }
    .logo__preview img { position: absolute; inset: var(--space-2); width: calc(100% - 2 * var(--space-2)); height: calc(100% - 2 * var(--space-2)); object-fit: contain; }
    .logo__preview--empty { background: var(--color-primary-soft); color: var(--color-primary); font-weight: var(--weight-bold); font-size: var(--text-xl); }
    .logo__progress { display: grid; gap: var(--space-1); width: min(100%, 18rem); font-size: var(--text-sm); color: var(--color-text-muted); }
    .logo__actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .hint { margin: 0; font-size: var(--text-sm); color: var(--color-text-muted); }
    .notice { margin: 0; }
    .fields { display: grid; gap: var(--space-1); }
    .fields mat-form-field { width: 100%; }
    .fields__submit { justify-self: start; min-height: var(--touch-target); margin-top: var(--space-2); }
    @media (max-width: 767px) { .fields__submit { justify-self: stretch; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandingForm {
  readonly mode = input<'setup' | 'settings'>('settings');
  /** Emitted after a successful save with the updated company. */
  readonly saved = output<CompanyDetail>();

  protected readonly auth = inject(AuthService);
  private readonly api = inject(MeApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly serverError = serverError;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    contact_email: ['', [Validators.email, Validators.maxLength(191)]],
    phone: ['', Validators.maxLength(40)],
    website: ['', Validators.maxLength(255)],
    address: ['', Validators.maxLength(500)],
  });

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly logoUrl = signal<string | null>(null);
  protected readonly logoError = signal<string | null>(null);
  protected readonly submitLabel = computed(() => (this.mode() === 'setup' ? 'Save and continue' : 'Save'));
  protected readonly initials = computed(() => (this.auth.user()?.company.name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join(''));

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const company = await firstValueFrom(this.api.company());
      const b = company.branding;
      this.form.setValue({ name: company.name, contact_email: b?.contact_email ?? '', phone: b?.phone ?? '', website: b?.website ?? '', address: b?.address ?? '' });
      this.logoUrl.set(b?.logo_url ?? null);
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    clearServerErrors(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const change: BrandingChange = { name: v.name.trim(), contact_email: v.contact_email.trim() || null, phone: v.phone.trim() || null,
      website: v.website.trim() || null, address: v.address.trim() || null };
    this.saving.set(true);
    try {
      const company = await this.unlocked(() => firstValueFrom(this.api.updateBranding(change)));
      if (company === null) return;
      const user = this.auth.user();
      if (user && user.company.name !== company.name) this.auth.setUser({ ...user, company: { ...user.company, name: company.name } });
      if (this.mode() === 'settings') this.snackBar.open('Saved. Suppliers will see these details.', 'Close', { duration: 4000 });
      this.saved.emit(company);
    } catch (error) {
      applyServerErrors(this.form, error);
    } finally {
      this.saving.set(false);
    }
  }

  async chooseLogo(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const problem = logoProblem(file);
    this.logoError.set(problem);
    if (problem) return;
    this.uploading.set(true);
    try {
      const company = await this.unlocked(() => firstValueFrom(this.api.uploadLogo(file)));
      if (company) {
        this.logoUrl.set(company.branding?.logo_url ?? null);
        this.snackBar.open('Logo uploaded.', 'Close', { duration: 3000 });
      }
    } catch (error) {
      const errors = error instanceof HttpErrorResponse ? (error.error?.errors?.logo as string[] | undefined) : undefined;
      this.logoError.set(errors?.[0] ?? 'We could not upload the logo. Please try again.');
    } finally {
      this.uploading.set(false);
    }
  }

  async removeLogo(): Promise<void> {
    this.uploading.set(true);
    try {
      const company = await this.unlocked(() => firstValueFrom(this.api.removeLogo()));
      if (company) this.logoUrl.set(null);
    } finally {
      this.uploading.set(false);
    }
  }

  /** Runs a change; when the server wants the emailed code first, asks for it and tries once more (null = cancelled). */
  private async unlocked<T>(run: () => Promise<T>): Promise<T | null> {
    try {
      return await run();
    } catch (error) {
      if (!(error instanceof HttpErrorResponse && error.error?.code === 'profile_locked')) throw error;
      const ok = await firstValueFrom(this.dialog.open(EmailCodeDialog, { width: '440px', maxWidth: 'calc(100vw - 32px)', autoFocus: false }).afterClosed());
      return ok ? run() : null;
    }
  }
}
