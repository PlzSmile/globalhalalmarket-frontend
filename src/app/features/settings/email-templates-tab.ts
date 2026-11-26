import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EmailTemplatesApi } from '../../core/api/email-templates-api';
import { EmailTemplate, EmailTemplateKind } from '../../core/models/email-templates';
import { errorMessage } from '../../shared/forms/error-message';
import { EmailComposer } from '../../shared/ui/email-composer';

/**
 * Settings → Email templates (12 Nov 2026, Bilal: like Xero). The default subject and message for each supplier
 * email, with a live preview. The certificate request opens in the Send email dialog with this text; the renewal
 * reminder is sent automatically with it. Owners and admins only (the tab is hidden for members).
 */
@Component({
  selector: 'hs-email-templates-tab',
  imports: [MatButtonModule, MatButtonToggleModule, EmailComposer],
  template: `
    <div class="templates">
      <p class="templates__intro">Write the emails your suppliers get. Words in [brackets] are filled in for each supplier, and your logo and details are added automatically.</p>
      @if (templates().length > 0) {
        <mat-button-toggle-group [value]="kind()" (change)="choose($event.value)" aria-label="Email template" class="templates__switch">
          @for (t of templates(); track t.kind) { <mat-button-toggle [value]="t.kind">{{ t.label }}</mat-button-toggle> }
        </mat-button-toggle-group>
        @if (current(); as t) {
          @if (t.is_default) { <p class="templates__note">This is our default wording. Change it and save to use your own.</p> }
          <hs-email-composer [kind]="t.kind" [placeholders]="t.placeholders" [(subject)]="subject" [(message)]="message" />
          @if (error(); as message) { <p class="notice notice--error" role="alert">{{ message }}</p> }
          <div class="templates__actions">
            <button mat-flat-button type="button" (click)="save()" [disabled]="busy()" data-test="save-template">Save template</button>
            @if (!t.is_default) { <button mat-button type="button" (click)="reset()" [disabled]="busy()" data-test="reset-template">Reset to default</button> }
          </div>
        }
      } @else {
        <p>{{ loadError() ?? 'Loading…' }}</p>
      }
    </div>
  `,
  styles: `
    .templates { display: grid; gap: var(--space-3); padding-top: var(--space-4); }
    .templates__intro, .templates__note { margin: 0; color: var(--color-text-muted); }
    .templates__switch { justify-self: start; flex-wrap: wrap; }
    .templates__actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .templates__actions button { min-height: var(--touch-target); }
    .notice { margin: 0; }
    @media (max-width: 767px) { .templates__switch { justify-self: stretch; } .templates__actions button { flex: 1 1 auto; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailTemplatesTab {
  private readonly api = inject(EmailTemplatesApi);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly templates = signal<readonly EmailTemplate[]>([]);
  protected readonly kind = signal<EmailTemplateKind>('upload_request');
  protected readonly current = signal<EmailTemplate | null>(null);
  protected readonly subject = signal('');
  protected readonly message = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.templates.set(await firstValueFrom(this.api.list()));
      this.choose(this.kind());
    } catch {
      this.loadError.set('The email templates could not be loaded. Please try again.');
    }
  }

  protected choose(kind: EmailTemplateKind): void {
    const t = this.templates().find((x) => x.kind === kind) ?? null;
    this.kind.set(kind);
    this.show(t);
  }

  private show(t: EmailTemplate | null): void {
    this.current.set(t);
    this.subject.set(t?.subject ?? '');
    this.message.set(t?.message ?? '');
    this.error.set(null);
  }

  private replace(t: EmailTemplate): void {
    this.templates.update((list) => list.map((x) => (x.kind === t.kind ? t : x)));
    this.show(t);
  }

  async save(): Promise<void> {
    if (this.subject().trim() === '' || this.message().trim() === '') {
      this.error.set('Enter a subject and a message.');
      return;
    }
    this.busy.set(true);
    try {
      this.replace(await firstValueFrom(this.api.save(this.kind(), this.subject().trim(), this.message())));
      this.snackBar.open('Template saved.', 'Close', { duration: 3000 });
    } catch (error) {
      this.error.set(errorMessage(error, 'The template could not be saved. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }

  async reset(): Promise<void> {
    this.busy.set(true);
    try {
      this.replace(await firstValueFrom(this.api.reset(this.kind())));
      this.snackBar.open('Back to the default wording.', 'Close', { duration: 3000 });
    } catch (error) {
      this.error.set(errorMessage(error, 'The template could not be reset. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }
}
