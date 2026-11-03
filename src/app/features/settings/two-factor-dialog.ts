import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MeApi } from '../../core/api/me-api';
import { TwoFactorSetup } from '../../core/models/auth';
import { errorMessage } from '../../shared/forms/error-message';
import { Loader } from '../../shared/ui/loader';
import { OtpInput } from '../../shared/ui/otp-input';

export type TwoFactorDialogMode = 'setup' | 'recovery' | 'disable';

/**
 * 3 Nov 2026: the authenticator app. Setup: password → scan the QR code (or type the key) → the app's first code →
 * the recovery codes, shown once. "recovery": new recovery codes (password). "disable": turn it off (password).
 * Closes with true when something changed.
 */
@Component({
  selector: 'hs-two-factor-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, Loader, OtpInput],
  template: `
    <h2 mat-dialog-title>{{ title() }}</h2>
    <mat-dialog-content class="content">
      @if (error(); as message) { <p class="notice notice--error" role="alert">{{ message }}</p> }
      @switch (step()) {
        @case ('password') {
          <p>{{ mode === 'disable' ? 'After this, log-in codes come by email.' : 'For your security, type your current password first.' }}</p>
          <form id="tf-password" (ngSubmit)="next()">
            <mat-form-field appearance="outline" class="full">
              <mat-label>Current password</mat-label>
              <input matInput type="password" [formControl]="password" autocomplete="current-password" data-test="tf-password" />
            </mat-form-field>
          </form>
        }
        @case ('scan') {
          @let s = setup();
          <ol class="steps">
            <li>Open an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 1Password …).</li>
            <li>Scan this QR code, or type the key by hand.</li>
            <li>Type the 6-digit code the app shows.</li>
          </ol>
          @if (s) {
            <div class="qr"><img [src]="s.qr" width="180" height="180" alt="QR code to add Global Halal Market to your authenticator app" /></div>
            <p class="key">Key: <span class="mono" data-test="tf-secret">{{ s.secret }}</span></p>
          }
          <hs-otp-input label="Code from the authenticator app" [disabled]="busy()" [error]="wrong()" (changed)="code.set($event)" (completed)="confirm($event)" />
        }
        @case ('codes') {
          <p class="notice notice--success" role="status">{{ mode === 'setup' ? 'The authenticator app is on.' : 'Here are your new recovery codes.' }}</p>
          <p>Save these recovery codes somewhere safe (a password manager is best). Each works once if you lose your phone. They are shown only now.</p>
          <ul class="codes" data-test="tf-codes">@for (c of codes(); track c) { <li class="mono">{{ c }}</li> }</ul>
          <button mat-stroked-button type="button" (click)="copy()">{{ copied() ? 'Copied' : 'Copy the codes' }}</button>
        }
      }
      @if (busy()) { <hs-loader label="Please wait" /> }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @switch (step()) {
        @case ('password') {
          <button mat-button type="button" mat-dialog-close>Cancel</button>
          <button mat-flat-button type="submit" form="tf-password" [disabled]="busy() || !password.value" data-test="tf-next">{{ mode === 'disable' ? 'Turn off' : 'Continue' }}</button>
        }
        @case ('scan') {
          <button mat-button type="button" mat-dialog-close>Cancel</button>
          <button mat-flat-button type="button" (click)="confirm()" [disabled]="busy() || code().length !== 6" data-test="tf-verify">Verify</button>
        }
        @case ('codes') { <button mat-flat-button type="button" (click)="ref.close(true)" data-test="tf-done">I saved them</button> }
      }
    </mat-dialog-actions>
  `,
  styles: `
    .content { display: grid; gap: var(--space-3); }
    .content p { margin: 0; }
    .full { width: 100%; }
    .steps { margin: 0; padding-inline-start: var(--space-5); display: grid; gap: var(--space-1); font-size: var(--text-sm); }
    .qr { display: grid; place-items: center; padding: var(--space-3); border-radius: var(--radius-lg); background: var(--color-qr-bg); border: 1px solid var(--color-border); justify-self: center; }
    .key { text-align: center; font-size: var(--text-sm); color: var(--color-text-muted); overflow-wrap: anywhere; }
    .codes { list-style: none; margin: 0; padding: var(--space-3); display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2);
      border-radius: var(--radius-md); background: var(--color-surface-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TwoFactorDialog {
  private readonly api = inject(MeApi);
  protected readonly ref = inject(MatDialogRef<TwoFactorDialog, boolean>);
  protected readonly mode = inject<TwoFactorDialogMode>(MAT_DIALOG_DATA);

  protected readonly step = signal<'password' | 'scan' | 'codes'>('password');
  protected readonly password = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  protected readonly setup = signal<TwoFactorSetup | null>(null);
  protected readonly code = signal('');
  protected readonly codes = signal<readonly string[]>([]);
  protected readonly busy = signal(false);
  protected readonly wrong = signal(false);
  protected readonly copied = signal(false);
  protected readonly error = signal<string | null>(null);

  protected title(): string {
    return this.mode === 'disable' ? 'Turn off the authenticator app' : this.mode === 'recovery' ? 'New recovery codes' : 'Turn on the authenticator app';
  }

  async next(): Promise<void> {
    if (this.busy() || !this.password.value) return;
    await this.run(async () => {
      const password = this.password.value;
      if (this.mode === 'disable') {
        await firstValueFrom(this.api.disableTwoFactor(password));
        this.ref.close(true);
      } else if (this.mode === 'recovery') {
        this.codes.set((await firstValueFrom(this.api.newRecoveryCodes(password))).recovery_codes);
        this.step.set('codes');
      } else {
        this.setup.set(await firstValueFrom(this.api.startTwoFactor(password)));
        this.step.set('scan');
      }
      this.password.setValue('');
    }, 'That did not work. Please try again.');
  }

  async confirm(code = this.code()): Promise<void> {
    if (this.busy() || code.length !== 6) return;
    this.wrong.set(false);
    const ok = await this.run(async () => {
      this.codes.set((await firstValueFrom(this.api.confirmTwoFactor(code))).recovery_codes);
      this.step.set('codes');
    }, 'That code did not work. Please try again.');
    if (!ok) this.wrong.set(true);
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.codes().join('\n'));
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  private async run(work: () => Promise<void>, fallback: string): Promise<boolean> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await work();
      return true;
    } catch (error) {
      this.error.set(errorMessage(error, fallback));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
