import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TeamApi } from '../../core/api/team-api';
import { AssignableRole, PendingInvitation } from '../../core/models/auth';
import { applyServerErrors, clearServerErrors, serverError } from '../../shared/forms/server-errors';

@Component({
  selector: 'hs-invite-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Invite people</h2>
    <form [formGroup]="form" (ngSubmit)="send()" novalidate>
      <mat-dialog-content class="invite-form">
        <mat-form-field appearance="outline">
          <mat-label>Work email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="off" required cdkFocusInitial />
          @if (form.controls.email.hasError('required')) { <mat-error>Enter an email address.</mat-error> }
          @else if (form.controls.email.hasError('email')) { <mat-error>Enter a valid email address.</mat-error> }
          @else if (serverError(form.controls.email); as message) { <mat-error>{{ message }}</mat-error> }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role">
            <mat-option value="member">Member: products, suppliers and certificates</mat-option>
            <mat-option value="admin">Admin: also manages the team</mat-option>
          </mat-select>
        </mat-form-field>
        <p class="muted">They get an email with a link that works for 7 days.</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" [disabled]="busy()">Send invitation</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `.invite-form { display: grid; gap: var(--space-2); min-width: min(100%, var(--container-form)); } .invite-form mat-form-field { width: 100%; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InviteDialog {
  private readonly api = inject(TeamApi);
  private readonly dialogRef = inject<MatDialogRef<InviteDialog, PendingInvitation>>(MatDialogRef);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    role: ['member' as AssignableRole, Validators.required],
  });
  protected readonly busy = signal(false);
  protected readonly serverError = serverError;

  async send(): Promise<void> {
    clearServerErrors(this.form);
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.busy.set(true);
    try {
      const { email, role } = this.form.getRawValue();
      this.dialogRef.close(await firstValueFrom(this.api.invite(email, role)));
    } catch (error) {
      applyServerErrors(this.form, error);
    } finally {
      this.busy.set(false);
    }
  }
}
