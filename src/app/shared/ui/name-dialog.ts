import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { applyServerErrorsOr, clearServerErrors, serverError } from '../forms/server-errors';
import { collapseSpaces } from '../forms/normalise';

export interface NameDialogData {
  readonly title: string;
  readonly label: string;
  readonly value: string;
  readonly maxLength: number;
  readonly save: (name: string) => Observable<unknown>;
}

/** Small "edit one name" dialog; saves itself so server messages show under the field. Closes with true. */
@Component({
  selector: 'hs-name-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        @if (formError(); as message) { <p class="notice notice--error" role="alert">{{ message }}</p> }
        <mat-form-field appearance="outline" class="field">
          <mat-label>{{ data.label }}</mat-label>
          <input matInput formControlName="name" [attr.maxlength]="data.maxLength" required cdkFocusInitial />
          @if (form.controls.name.hasError('required')) { <mat-error>Enter a name.</mat-error> }
          @else if (serverError(form.controls.name); as message) { <mat-error>{{ message }}</mat-error> }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" class="btn" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" class="btn" [disabled]="busy()">Save</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `.field { width: 100%; } .btn { min-height: 44px; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NameDialog {
  protected readonly data = inject<NameDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<NameDialog, boolean>>(MatDialogRef);
  protected readonly serverError = serverError;
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data.value, [Validators.required, Validators.maxLength(this.data.maxLength)]],
  });

  protected async save(): Promise<void> {
    clearServerErrors(this.form);
    this.formError.set(null);
    const name = collapseSpaces(this.form.controls.name.value);
    this.form.controls.name.setValue(name);
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    try {
      await firstValueFrom(this.data.save(name));
      this.dialogRef.close(true);
    } catch (error) {
      this.formError.set(applyServerErrorsOr(this.form, error, 'This could not be saved. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }
}
