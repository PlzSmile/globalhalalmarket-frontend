import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UploadRequestsApi } from '../../core/api/upload-requests-api';
import { SupplierDetail } from '../../core/models/catalogue';
import { SentUploadRequest } from '../../core/models/upload-requests';
import { errorMessage } from '../../shared/forms/error-message';
import { collapseSpaces } from '../../shared/forms/normalise';

export interface UploadRequestDialogData { readonly supplier: SupplierDetail; }

/** Send an upload link; the link is shown once afterwards (copy for WhatsApp/Teams). */
@Component({
  selector: 'hs-upload-request-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatCheckboxModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Request certificates</h2>
    @if (sent(); as s) {
      <mat-dialog-content class="fields">
        <p>{{ s.emailed_to_saved_address ? 'Sent by email to ' + data.supplier.contact_email + '.' : 'Not emailed.' }}</p>
        <p class="notice notice--warning">Anyone with this link can upload certificates for this supplier until it closes. Share it only with the supplier.</p>
        <mat-form-field appearance="outline">
          <mat-label>Upload link</mat-label>
          <input matInput [value]="s.link" readonly data-test="link" (focus)="$any($event.target).select()" />
        </mat-form-field>
        <button mat-stroked-button type="button" class="btn" (click)="copy()" data-test="copy">Copy link</button>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-flat-button type="button" class="btn" [mat-dialog-close]="true">Done</button>
      </mat-dialog-actions>
    } @else {
      <form (ngSubmit)="submit()" novalidate>
        <mat-dialog-content class="fields">
          @if (formError(); as message) { <p class="notice notice--error" role="alert">{{ message }}</p> }
          <fieldset class="ingredients">
            <legend class="field-label">Ingredients that need a certificate</legend>
            @for (ingredient of data.supplier.ingredients; track ingredient.id) {
              <mat-checkbox [checked]="selected().has(ingredient.id)" (change)="toggle(ingredient.id, $event.checked)">{{ ingredient.name }}</mat-checkbox>
            }
          </fieldset>
          <mat-form-field appearance="outline">
            <mat-label>Note to the supplier (optional)</mat-label>
            <textarea matInput [formControl]="note" maxlength="500" rows="3"></textarea>
          </mat-form-field>
          @if (data.supplier.contact_email; as email) {
            <mat-checkbox [formControl]="sendEmail" data-test="send-email">Email the link to {{ email }}</mat-checkbox>
          } @else {
            <p class="notice notice--info" data-test="no-email">No email saved — you can copy the link and send it yourself.</p>
          }
        </mat-dialog-content>
        <mat-dialog-actions align="end">
          <button mat-button type="button" class="btn" mat-dialog-close>Cancel</button>
          <button mat-flat-button type="submit" class="btn" [disabled]="busy()" data-test="send">Send request</button>
        </mat-dialog-actions>
      </form>
    }
  `,
  styles: `
    .fields { display: grid; gap: var(--space-3); min-width: min(100%, var(--container-form)); }
    .fields mat-form-field { width: 100%; }
    .ingredients { border: 0; margin: 0; padding: 0; display: grid; gap: var(--space-1); }
    .ingredients mat-checkbox { min-height: 44px; display: flex; align-items: center; }
    .field-label { font-weight: var(--weight-semibold); }
    .btn { min-height: 44px; }
    .notice { margin: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UploadRequestDialog {
  protected readonly data = inject<UploadRequestDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(UploadRequestsApi);
  private readonly snackBar = inject(MatSnackBar);
  private readonly clipboard = inject(Clipboard);

  protected readonly selected = signal<ReadonlySet<number>>(new Set(this.data.supplier.ingredients.map((i) => i.id)));
  protected readonly note = new FormControl('', { nonNullable: true });
  protected readonly sendEmail = new FormControl(this.data.supplier.contact_email !== null, { nonNullable: true });
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly sent = signal<SentUploadRequest | null>(null);

  protected toggle(id: number, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.selected.set(next);
    this.formError.set(null);
  }

  protected async submit(): Promise<void> {
    if (this.busy()) {
      return;
    }
    if (this.selected().size === 0) {
      this.formError.set('Choose at least one ingredient.');
      return;
    }
    this.busy.set(true);
    this.formError.set(null);
    try {
      const note = collapseSpaces(this.note.value);
      const sent = await firstValueFrom(this.api.send(this.data.supplier.id, {
        ingredient_ids: this.data.supplier.ingredients.map((i) => i.id).filter((id) => this.selected().has(id)),
        note: note === '' ? null : note,
        send_email: this.data.supplier.contact_email !== null && this.sendEmail.value,
      }));
      this.sent.set(sent);
      this.snackBar.open('Upload link sent.', 'Close', { duration: 4000 });
    } catch (error) {
      this.formError.set(errorMessage(error, 'The request could not be sent. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected copy(): void {
    const link = this.sent()?.link;
    if (link && this.clipboard.copy(link)) {
      this.snackBar.open('Link copied.', 'Close', { duration: 3000 });
    }
  }
}
