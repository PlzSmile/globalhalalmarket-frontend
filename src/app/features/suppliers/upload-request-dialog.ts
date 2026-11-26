import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EmailTemplatesApi } from '../../core/api/email-templates-api';
import { UploadRequestsApi } from '../../core/api/upload-requests-api';
import { SupplierDetail } from '../../core/models/catalogue';
import { CERTIFICATE_TYPES, CertificateType } from '../../core/models/certificates';
import { EmailTemplate, MAX_RECIPIENTS } from '../../core/models/email-templates';
import { SentUploadRequest } from '../../core/models/upload-requests';
import { errorMessage } from '../../shared/forms/error-message';
import { ukDateTime } from '../../shared/format/uk-date';
import { EmailChips } from '../../shared/ui/email-chips';
import { EmailComposer } from '../../shared/ui/email-composer';
import { SecurityBadge } from '../../shared/ui/security-badge';

export interface UploadRequestDialogData {
  readonly supplier: SupplierDetail;
  /** The supplier already has an open link (sending a new one replaces it). */
  readonly hasOpenLink?: boolean;
}

/**
 * "Send email" for a certificate request (12 Nov 2026, Bilal: like Xero). The customer picks the ingredients, the
 * recipients (To, Cc, Bcc) and can change the subject and message (filled from their email template) while a live
 * preview shows the email as the supplier gets it. "Create link only" makes the link without an email. The link is
 * shown once afterwards (copy for WhatsApp/Teams).
 */
@Component({
  selector: 'hs-upload-request-dialog',
  imports: [MatButtonModule, MatCheckboxModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, EmailChips, EmailComposer, SecurityBadge],
  template: `
    <h2 mat-dialog-title>{{ sent() ? 'Request sent' : 'Send email' }}</h2>
    @if (sent(); as s) {
      <mat-dialog-content class="fields">
        @if (s.email.status === 'sent') {
          <p data-test="sent-to">Emailed to <strong>{{ s.email.to }}</strong> at {{ time(s.email.at) }}. If it has not arrived in a few minutes, ask the supplier to check their spam folder, or copy the link below.</p>
        } @else if (emailWanted()) {
          <p class="notice notice--warning" role="alert">The email could not be sent. Copy the link and send it yourself.</p>
        } @else {
          <p>Not emailed.</p>
        }
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
      <form class="send-form" (submit)="$event.preventDefault(); submit(true)" novalidate>
        <mat-dialog-content class="send">
          @if (formError(); as message) { <p class="notice notice--error" role="alert" data-test="form-error">{{ message }}</p> }
          @if (data.hasOpenLink) { <p class="notice notice--info" data-test="replaces">Sending a new link stops the open link for this supplier.</p> }
          @if (template(); as t) {
            <hs-email-composer kind="upload_request" [placeholders]="t.placeholders" [supplierId]="data.supplier.id" [ingredientIds]="ingredientIds()"
              [certificateType]="certificateType()" [(subject)]="subject" [(message)]="message">
              <!-- 19 Nov 2026 (Bilal): ask for one certificate type, as in the manual; halal by default. -->
              <mat-form-field appearance="outline" class="type-field">
                <mat-label>Certificate type</mat-label>
                <mat-select [value]="certificateType()" (selectionChange)="certificateType.set($event.value)" data-test="certificate-type">
                  @for (type of certificateTypes; track type.value) { <mat-option [value]="type.value">{{ type.label }}</mat-option> }
                </mat-select>
                <mat-hint>The email names this type and the supplier's upload page starts on it.</mat-hint>
              </mat-form-field>
              <fieldset class="ingredients">
                <legend class="field-label">Ingredients that need a certificate</legend>
                @for (ingredient of data.supplier.ingredients; track ingredient.id) {
                  <mat-checkbox [checked]="selected().has(ingredient.id)" (change)="toggle(ingredient.id, $event.checked)">{{ ingredient.name }}</mat-checkbox>
                }
              </fieldset>
              <hs-email-chips label="To" [(emails)]="to" />
              @if (showCopies()) {
                <hs-email-chips label="Cc" [(emails)]="cc" />
                <hs-email-chips label="Bcc" [(emails)]="bcc" />
              } @else {
                <button mat-button type="button" class="copies" (click)="showCopies.set(true)" data-test="show-copies">Add Cc or Bcc</button>
              }
            </hs-email-composer>
          } @else {
            <p>{{ loadError() ?? 'Loading your email template…' }}</p>
          }
          <hs-security-badge />
        </mat-dialog-content>
        <mat-dialog-actions class="actions">
          <button mat-button type="button" class="btn" mat-dialog-close>Cancel</button>
          <span class="actions__space"></span>
          <button mat-stroked-button type="button" class="btn" (click)="submit(false)" [disabled]="busy()" data-test="link-only">Create link only</button>
          <button mat-flat-button type="submit" class="btn" [disabled]="busy() || !template()" data-test="send">Send email</button>
        </mat-dialog-actions>
      </form>
    }
  `,
  styles: `
    .fields { display: grid; gap: var(--space-3); min-width: min(100%, var(--container-form)); }
    .fields mat-form-field { width: 100%; }
    /* 13 Nov 2026 (Bilal): a tall dialog with one scroll; the preview fills the height and stays in view. */
    .send-form { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .send.mat-mdc-dialog-content { display: grid; gap: var(--space-3); flex: 1 1 auto; max-height: none; min-height: 0; overflow: auto; }
    @media (min-width: 1200px) { .send hs-email-composer { --composer-frame-height: calc(100dvh - 300px); } }
    .type-field { width: 100%; }
    /* Ingredients side by side, wrapping onto the next line when they do not fit. */
    .ingredients { border: 0; margin: 0 0 var(--space-2); padding: 0; display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
    .ingredients .field-label { flex-basis: 100%; margin-bottom: var(--space-1); }
    /* Each ingredient is a small bordered box with 3px corners, green when ticked (Bilal, 13 Nov 2026). */
    .ingredients mat-checkbox { min-height: var(--touch-target); display: flex; align-items: center; padding-inline-end: var(--space-3);
      border: 1px solid var(--color-border); border-radius: var(--radius-box); background: var(--color-surface); }
    .ingredients mat-checkbox.mat-mdc-checkbox-checked { border-color: var(--color-primary); background: var(--color-primary-soft); }
    .field-label { font-weight: var(--weight-semibold); }
    .copies { justify-self: start; margin-bottom: var(--space-2); }
    .btn { min-height: var(--touch-target); }
    .notice { margin: 0; }
    .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .actions__space { flex: 1; }
    @media (max-width: 767px) { .actions .btn { flex: 1 1 auto; } .actions__space { display: none; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UploadRequestDialog {
  protected readonly data = inject<UploadRequestDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(UploadRequestsApi);
  private readonly templates = inject(EmailTemplatesApi);
  private readonly snackBar = inject(MatSnackBar);
  private readonly clipboard = inject(Clipboard);

  protected readonly selected = signal<ReadonlySet<number>>(new Set(this.data.supplier.ingredients.map((i) => i.id)));
  protected readonly ingredientIds = computed(() => this.data.supplier.ingredients.map((i) => i.id).filter((id) => this.selected().has(id)));
  protected readonly to = signal<readonly string[]>(this.data.supplier.contact_email ? [this.data.supplier.contact_email.toLowerCase()] : []);
  protected readonly cc = signal<readonly string[]>([]);
  protected readonly bcc = signal<readonly string[]>([]);
  protected readonly showCopies = signal(false);
  /** 19 Nov 2026 (Bilal): the certificate type the request asks for. */
  protected readonly certificateType = signal<CertificateType>('halal');
  protected readonly certificateTypes = CERTIFICATE_TYPES;
  protected readonly subject = signal('');
  protected readonly message = signal('');
  protected readonly template = signal<EmailTemplate | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly sent = signal<SentUploadRequest | null>(null);
  /** Whether the user asked for the email (to tell a failed email apart from "not emailed"). */
  protected readonly emailWanted = signal(false);

  constructor() {
    void this.loadTemplate();
  }

  private async loadTemplate(): Promise<void> {
    try {
      const all = await firstValueFrom(this.templates.list());
      const t = all.find((x) => x.kind === 'upload_request') ?? null;
      if (t) {
        this.subject.set(t.subject);
        this.message.set(t.message);
      }
      this.template.set(t);
    } catch {
      this.loadError.set('Your email template could not be loaded. You can still create the link only.');
    }
  }

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

  /** Why the email cannot go yet, or null. */
  private emailProblem(): string | null {
    const count = this.to().length + this.cc().length + this.bcc().length;
    if (this.to().length === 0) return 'Add at least one email address in To.';
    if (count > MAX_RECIPIENTS) return `Send to at most ${MAX_RECIPIENTS} addresses in total (To, Cc and Bcc).`;
    if (this.subject().trim() === '') return 'Enter a subject.';
    if (this.message().trim() === '') return 'Enter a message.';
    return null;
  }

  protected async submit(sendEmail: boolean): Promise<void> {
    if (this.busy()) return;
    if (this.ingredientIds().length === 0) {
      this.formError.set('Choose at least one ingredient.');
      return;
    }
    const problem = sendEmail ? this.emailProblem() : null;
    if (problem) {
      this.formError.set(problem);
      return;
    }
    this.busy.set(true);
    this.formError.set(null);
    this.emailWanted.set(sendEmail);
    try {
      const sent = await firstValueFrom(this.api.send(this.data.supplier.id, {
        ingredient_ids: this.ingredientIds(),
        certificate_type: this.certificateType(),
        note: null,
        send_email: sendEmail,
        ...(sendEmail ? { email: { to: this.to(), cc: this.cc(), bcc: this.bcc(), subject: this.subject().trim(), message: this.message() } } : {}),
      }));
      this.sent.set(sent);
      this.snackBar.open(sendEmail ? 'Email sent.' : 'Upload link created.', 'Close', { duration: 4000 });
    } catch (error) {
      this.formError.set(errorMessage(error, 'The request could not be sent. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected time(iso: string | null): string {
    return iso ? ukDateTime(iso) : '';
  }

  protected copy(): void {
    const link = this.sent()?.link;
    if (link && this.clipboard.copy(link)) {
      this.snackBar.open('Link copied.', 'Close', { duration: 3000 });
    }
  }
}
