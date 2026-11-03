import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MeApi } from '../../core/api/me-api';
import { errorMessage } from '../../shared/forms/error-message';
import { Loader } from '../../shared/ui/loader';
import { OtpInput } from '../../shared/ui/otp-input';

/**
 * 3 Nov 2026 (Bilal): before the profile can be changed, a 6-digit code goes to the user's email. The code checks itself
 * once all six digits are in (the Verify button does the same). Closes with true when the profile is unlocked.
 */
@Component({
  selector: 'hs-email-code-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, Loader, OtpInput],
  template: `
    <h2 mat-dialog-title class="title"><span class="title__icon" aria-hidden="true"><mat-icon svgIcon="mail" /></span>Confirm it's you</h2>
    <mat-dialog-content class="content">
      @if (hint(); as h) {
        <p>We sent a 6-digit code to <strong>{{ h }}</strong>. Type it below to edit your profile for the next 15 minutes.</p>
      } @else if (!error()) {
        <p>Sending a code to your email…</p>
      }
      @if (error(); as message) { <p class="notice notice--error" role="alert" data-test="code-error">{{ message }}</p> }
      <hs-otp-input label="Code from the email" [disabled]="busy() || !hint()" [error]="wrong()" (changed)="code.set($event)" (completed)="verify($event)" />
      @if (busy()) { <hs-loader label="Checking" /> }
      <button mat-button type="button" class="resend" (click)="send()" [disabled]="busy() || resendIn() > 0" data-test="resend">
        {{ resendIn() > 0 ? 'Send a new code in ' + resendIn() + ' s' : 'Send a new code' }}
      </button>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancel</button>
      <button mat-flat-button type="button" (click)="verify()" [disabled]="busy() || code().length !== 6" data-test="verify">Verify</button>
    </mat-dialog-actions>
  `,
  styles: `
    .title { display: flex; align-items: center; gap: var(--space-3); }
    .title__icon { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: 50%; background: var(--color-primary-soft); color: var(--color-primary); }
    .title__icon mat-icon { width: 18px; height: 18px; }
    .content { display: grid; gap: var(--space-4); }
    .content p { margin: 0; }
    .resend { justify-self: center; min-height: var(--touch-target); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailCodeDialog implements OnInit {
  private readonly api = inject(MeApi);
  private readonly ref = inject(MatDialogRef<EmailCodeDialog, boolean>);

  protected readonly hint = signal<string | null>(null);
  protected readonly code = signal('');
  protected readonly busy = signal(false);
  protected readonly wrong = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly resendIn = signal(0);
  private readonly otp = viewChild(OtpInput);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  ngOnInit(): void {
    void this.send();
  }

  async send(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const sent = await firstValueFrom(this.api.sendProfileCode());
      this.hint.set(sent.email_hint);
      this.countdown(sent.resend_after);
      setTimeout(() => this.otp()?.focus());
    } catch (error) {
      const wait = error instanceof HttpErrorResponse ? Number(error.error?.resend_after ?? 0) : 0;
      if (wait > 0) {
        this.hint.set(this.hint() ?? 'your email'); // an earlier code is still on its way
        this.countdown(wait);
      } else {
        this.error.set(errorMessage(error, 'The code could not be sent. Please try again.'));
      }
    } finally {
      this.busy.set(false);
    }
  }

  async verify(code = this.code()): Promise<void> {
    if (this.busy() || code.length !== 6) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.wrong.set(false);
    try {
      await firstValueFrom(this.api.verifyProfileCode(code));
      this.ref.close(true);
    } catch (error) {
      this.error.set(errorMessage(error, 'That code did not work. Please try again.'));
      this.wrong.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  private countdown(seconds: number): void {
    clearInterval(this.timer);
    this.resendIn.set(seconds);
    this.timer = setInterval(() => {
      this.resendIn.update((s) => Math.max(0, s - 1));
      if (this.resendIn() === 0) clearInterval(this.timer);
    }, 1000);
  }
}
