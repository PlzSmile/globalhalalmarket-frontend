import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, model, signal, viewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TextFieldModule } from '@angular/cdk/text-field';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { EmailTemplatesApi } from '../../core/api/email-templates-api';
import { EmailTemplateKind } from '../../core/models/email-templates';

/** How long typing must pause before the preview is drawn again. */
export const PREVIEW_DELAY_MS = 400;

/** The preview is drawn a little smaller so the whole email fits without scrolling (Bilal, 13 Nov 2026). */
export const PREVIEW_ZOOM = 0.8;

/** The email HTML with a smaller scale for the preview frame. */
export function zoomed(html: string, zoom = PREVIEW_ZOOM): string {
  const style = `<style>html{zoom:${zoom}}</style>`;
  return html.includes('</head>') ? html.replace('</head>', `${style}</head>`) : style + html;
}

/**
 * Subject + message with an "Add placeholder" menu and, beside it (below on small screens), a live preview of the
 * email exactly as the supplier gets it, drawn by the server (12 Nov 2026, Bilal: like Xero's "Send email").
 * Used by the Send email dialog and by Settings → Email templates.
 */
@Component({
  selector: 'hs-email-composer',
  imports: [TextFieldModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatMenuModule],
  template: `
    <div class="composer">
      <div class="composer__write">
        <ng-content />
        <mat-form-field appearance="outline">
          <mat-label>Subject</mat-label>
          <input matInput #subjectInput [value]="subject()" (input)="subject.set(subjectInput.value)" (focus)="target = 'subject'" maxlength="200" required data-test="subject" />
        </mat-form-field>
        <div class="composer__toolbar">
          <span class="composer__label" id="message-label">Message</span>
          <button mat-button type="button" [matMenuTriggerFor]="placeholderMenu" data-test="add-placeholder">Add placeholder</button>
          <mat-menu #placeholderMenu="matMenu">
            @for (name of placeholders(); track name) {
              <button mat-menu-item type="button" (click)="insert(name)">{{ name }}</button>
            }
          </mat-menu>
        </div>
        <mat-form-field appearance="outline" class="composer__message">
          <textarea matInput #messageInput cdkTextareaAutosize cdkAutosizeMinRows="8" cdkAutosizeMaxRows="22" aria-labelledby="message-label"
            [value]="message()" (input)="message.set(messageInput.value)" (focus)="target = 'message'" maxlength="5000" required data-test="message"></textarea>
          <mat-hint>Words in [brackets] are filled in for each supplier. [Upload Link] is where the Upload button goes.</mat-hint>
        </mat-form-field>
      </div>
      <section class="composer__preview" aria-label="Preview of the email">
        <p class="composer__preview-title">Preview</p>
        @if (previewSubject(); as s) { <p class="composer__preview-subject"><strong>{{ s }}</strong></p> }
        @if (previewHtml(); as html) {
          <!-- sandbox with no permissions: the email's HTML is shown, nothing in it can run or navigate -->
          <iframe class="composer__frame" sandbox="" [srcdoc]="html" title="Email preview" data-test="preview"></iframe>
        } @else {
          <p class="composer__preview-empty">{{ previewError() ?? 'Loading the preview…' }}</p>
        }
      </section>
    </div>
  `,
  styles: `
    .composer { display: grid; gap: var(--space-4); }
    /* Both halves are cards with a thin border and 3px corners (Bilal, 13 Nov 2026). */
    .composer__write { display: grid; gap: var(--space-1); align-content: start; min-width: 0; padding: var(--space-3);
      border: 1px solid var(--color-border); border-radius: var(--radius-box); background: var(--color-surface); }
    .composer__write mat-form-field { width: 100%; }
    .composer__toolbar { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
    .composer__label { font-weight: var(--weight-semibold); }
    .composer__message textarea { line-height: 1.5; }
    /* Sticky: stays in view while the left side scrolls (13 Nov 2026: one scroll, not three). */
    .composer__preview { position: sticky; top: 0; display: grid; gap: var(--space-2); align-content: start; min-width: 0; padding: var(--space-3);
      border: 1px solid var(--color-border); border-radius: var(--radius-box); background: var(--color-surface-muted); }
    .composer__preview-title { margin: 0; font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--color-text-muted); }
    .composer__preview-subject { margin: 0; }
    .composer__preview-empty { margin: 0; color: var(--color-text-muted); }
    .composer__frame { width: 100%; height: var(--composer-frame-height, 34rem); border: 1px solid var(--color-border); border-radius: var(--radius-box); background: var(--color-surface); }
    @media (min-width: 1200px) { .composer { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
    @media (max-width: 767px) { .composer__frame { height: 28rem; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailComposer {
  readonly kind = input.required<EmailTemplateKind>();
  readonly placeholders = input<readonly string[]>([]);
  /** With a supplier and ingredients the preview uses their real names; else sample names. */
  readonly supplierId = input<number | null>(null);
  readonly ingredientIds = input<readonly number[]>([]);
  /** 19 Nov 2026: the certificate type the request asks for (fills [Certificate Type] in the preview). */
  readonly certificateType = input<string>('halal');
  readonly subject = model('');
  readonly message = model('');

  private readonly api = inject(EmailTemplatesApi);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly subjectInput = viewChild<ElementRef<HTMLInputElement>>('subjectInput');
  private readonly messageInput = viewChild<ElementRef<HTMLTextAreaElement>>('messageInput');
  protected readonly previewHtml = signal<SafeHtml | null>(null);
  protected readonly previewSubject = signal<string | null>(null);
  protected readonly previewError = signal<string | null>(null);
  /** The field a placeholder goes into: the last one that had the focus. */
  protected target: 'subject' | 'message' = 'message';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private requestNo = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    effect(() => {
      const input = { kind: this.kind(), subject: this.subject(), message: this.message(), supplier_id: this.supplierId(), ingredient_ids: this.ingredientIds(), certificate_type: this.certificateType() };
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.refresh(input), PREVIEW_DELAY_MS);
    });
  }

  /** Puts [Name] where the cursor is in the subject or message (at the end when the field never had the focus). */
  protected insert(name: string): void {
    const token = `[${name}]`;
    const field = this.target === 'subject' ? this.subjectInput()?.nativeElement : this.messageInput()?.nativeElement;
    const value = this.target === 'subject' ? this.subject() : this.message();
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    (this.target === 'subject' ? this.subject : this.message).set(next);
    queueMicrotask(() => {
      if (!field) return;
      field.focus();
      field.setSelectionRange(start + token.length, start + token.length);
    });
  }

  private async refresh(input: Parameters<EmailTemplatesApi['preview']>[0]): Promise<void> {
    const no = ++this.requestNo;
    try {
      const preview = await firstValueFrom(this.api.preview(input));
      if (no !== this.requestNo) return; // a newer preview is on its way
      // Trusted: our own server's email HTML (typed text is escaped there), shown in a sandboxed iframe without scripts.
      this.previewHtml.set(this.sanitizer.bypassSecurityTrustHtml(zoomed(preview.html)));
      this.previewSubject.set(preview.subject);
      this.previewError.set(null);
    } catch {
      if (no !== this.requestNo) return;
      this.previewHtml.set(null);
      this.previewError.set('The preview could not be loaded. Your text is still kept.');
    }
  }
}
