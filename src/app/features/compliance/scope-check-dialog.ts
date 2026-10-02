import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { CertificatesApi } from '../../core/api/certificates-api';
import { ScopeCheck, ScopeCheckResult } from '../../core/models/compliance';
import { AuthorityCode } from '../../core/models/markets';
import { errorMessage } from '../../shared/forms/error-message';
import { collapseSpaces } from '../../shared/forms/normalise';

export interface ScopeCheckDialogData {
  readonly certificateId: number;
  readonly authorityCode: AuthorityCode;
  readonly authority: string;
  readonly current: ScopeCheck | null;
}

/** An owner/admin decides whether a certificate's scope covers a market. Closes with the saved decision. */
@Component({
  selector: 'hs-scope-check-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatRadioModule],
  template: `
    <h2 mat-dialog-title>Does the scope cover {{ data.authority }}?</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content class="content">
        <p class="muted">Compare the certificate scope with what {{ data.authority }} accepts. Your name and today's date are saved with the decision.</p>
        <mat-radio-group formControlName="result" class="choices" aria-label="Decision">
          <mat-radio-button value="covers">Covers {{ data.authority }}</mat-radio-button>
          <mat-radio-button value="not_covered">Does not cover {{ data.authority }} (this market turns red)</mat-radio-button>
        </mat-radio-group>
        @if (submitted() && form.controls.result.invalid) { <p class="field-error" role="alert">Choose covers or does not cover.</p> }
        <mat-form-field appearance="outline" class="note">
          <mat-label>Note (optional)</mat-label>
          <textarea matInput formControlName="note" maxlength="300" rows="3"></textarea>
          <mat-hint align="end">{{ form.controls.note.value.length }} / 300</mat-hint>
        </mat-form-field>
        @if (error(); as message) { <p class="notice notice--error" role="alert">{{ message }}</p> }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" class="btn" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" class="btn" [disabled]="busy()">Save decision</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content { display: grid; gap: var(--space-3); }
    .choices { display: grid; gap: var(--space-2); }
    .choices mat-radio-button { display: flex; align-items: center; min-height: 44px; }
    .note { width: 100%; }
    .field-error { color: var(--color-danger-fg); font-size: var(--text-sm); margin: 0; }
    .btn { min-height: 44px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScopeCheckDialog {
  protected readonly data = inject<ScopeCheckDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ScopeCheckDialog, ScopeCheck>>(MatDialogRef);
  private readonly api = inject(CertificatesApi);

  protected readonly form = new FormGroup({
    result: new FormControl<ScopeCheckResult | null>(this.data.current?.result ?? null, { validators: [Validators.required] }),
    note: new FormControl(this.data.current?.note ?? '', { nonNullable: true, validators: [Validators.maxLength(300)] }),
  });
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    const result = this.form.controls.result.value;
    if (this.form.invalid || result === null || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const note = collapseSpaces(this.form.controls.note.value);
      this.ref.close(await firstValueFrom(this.api.setScopeCheck(this.data.certificateId, this.data.authorityCode, result, note === '' ? null : note)));
    } catch (error) {
      // 409: the certificate was archived meanwhile — the server's message says what to do.
      const conflict = error instanceof HttpErrorResponse && error.status === 409 && typeof error.error?.message === 'string' ? (error.error.message as string) : null;
      this.error.set(conflict ?? errorMessage(error, 'The decision could not be saved. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }
}
