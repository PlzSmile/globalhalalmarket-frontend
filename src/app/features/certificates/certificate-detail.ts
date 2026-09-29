import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CertificatesApi } from '../../core/api/certificates-api';
import { BrowserNavigation } from '../../core/browser/navigation';
import { CertificateDetail, bodyName } from '../../core/models/certificates';
import { errorMessage, isNotFound } from '../../shared/forms/error-message';
import { expiryNote, fileSize, ukDate } from '../../shared/format/uk-date';
import { CertificateStatusBadge } from '../../shared/ui/certificate-status-badge';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/ui/confirm-dialog';
import { NameDialog, NameDialogData } from '../../shared/ui/name-dialog';
import { CertificateDialog, CertificateDialogData } from './certificate-dialog';

type State = { kind: 'loading' } | { kind: 'notFound' } | { kind: 'error' } | { kind: 'ready'; certificate: CertificateDetail };

@Component({
  selector: 'hs-certificate-detail',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule, CertificateStatusBadge],
  template: `
    <a routerLink="/certificates" class="back">← All certificates</a>
    @let s = state();
    @if (s.kind === 'loading') {
      <mat-progress-bar mode="indeterminate" aria-label="Loading certificate" />
    } @else if (s.kind === 'notFound') {
      <mat-card appearance="outlined" class="hs-card"><mat-card-content class="load-error">
        <h1 class="card-title">Certificate not found</h1>
        <p class="muted">It may have been deleted.</p>
        <a mat-stroked-button routerLink="/certificates" class="btn">Back to certificates</a>
      </mat-card-content></mat-card>
    } @else if (s.kind === 'error') {
      <mat-card appearance="outlined" class="hs-card"><mat-card-content class="load-error">
        <p role="alert">We couldn't load this certificate.</p>
        <button mat-stroked-button type="button" class="btn" (click)="load()" data-test="retry">Try again</button>
      </mat-card-content></mat-card>
    } @else {
      @let c = s.certificate;
      <header class="page-top">
        <div>
          <h1 class="page-top__title">{{ name(c) }}</h1>
          @if (!c.body) { <p class="notice notice--info">Not in our list of bodies — counts as not recognised by any authority.</p> }
          <hs-certificate-status-badge [status]="c.status" />
        </div>
        <div class="actions">
          <button mat-flat-button type="button" class="btn" (click)="download()" [disabled]="busy()" data-test="download"><mat-icon svgIcon="file" /> Download PDF</button>
          @if (c.status !== 'approved') { <button mat-stroked-button type="button" class="btn" (click)="approve()" [disabled]="busy()" data-test="approve">Approve</button> }
          @if (c.status !== 'rejected') { <button mat-stroked-button type="button" class="btn" (click)="reject()" [disabled]="busy()" data-test="reject">Reject</button> }
          <button mat-stroked-button type="button" class="btn" (click)="edit(c)" [disabled]="busy()">Edit</button>
          <button mat-stroked-button type="button" class="btn" (click)="deleteCertificate()" [disabled]="busy()">Delete</button>
        </div>
      </header>

      <mat-card appearance="outlined" class="hs-card">
        <mat-card-content>
          <dl class="facts">
            <dt>Supplier</dt><dd><a [routerLink]="['/suppliers', c.supplier.id]">{{ c.supplier.name }}</a></dd>
            <dt>Certificate number</dt><dd class="mono">{{ c.certificate_number ?? '—' }}</dd>
            <dt>Issued</dt><dd>{{ c.issued_on ? date(c.issued_on) : '—' }}</dd>
            <dt>Expires</dt>
            <dd>{{ date(c.expires_on) }} @if (expiry(c.expires_on).text; as note) { <span [class]="'note note--' + expiry(c.expires_on).tone">{{ note }}</span> }</dd>
            <dt>Scope</dt><dd>{{ c.scope ?? '—' }}</dd>
            <dt>Covers</dt><dd>{{ c.ingredients.length ? ingredientNames(c) : 'Covers no ingredients — edit to choose them' }}</dd>
            <dt>File</dt><dd>{{ c.file.original_name }} · {{ size(c.file.size) }}</dd>
            @if (c.reviewed_by) { <dt>Reviewed</dt><dd>{{ c.reviewed_by.name }}{{ c.reviewed_at ? ', ' + date(c.reviewed_at) : '' }}</dd> }
            @if (c.rejection_reason) { <dt>Reason</dt><dd>{{ c.rejection_reason }}</dd> }
          </dl>
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: `
    :host { display: grid; gap: var(--space-4); }
    .back { display: inline-flex; align-items: center; min-height: 44px; }
    .page-top { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
    .page-top__title { font-size: var(--text-3xl); margin-bottom: var(--space-2); }
    .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .btn { min-height: 44px; }
    .card-title { font-size: var(--text-xl); }
    .facts { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-1) var(--space-4); margin: 0; }
    .facts dt { color: var(--color-text-muted); font-size: var(--text-sm); }
    .facts dd { margin: 0 0 var(--space-3); }
    .facts a { display: inline-flex; align-items: center; min-height: 44px; }
    @media (min-width: 768px) { .facts { grid-template-columns: 12rem minmax(0, 1fr); } .facts dd { margin: 0; } }
    .note { margin-inline-start: var(--space-2); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
    .note--danger { color: var(--color-danger-fg); }
    .note--warning { color: var(--color-warning-fg); }
    .load-error { display: grid; gap: var(--space-3); justify-items: start; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificateDetailPage implements OnInit {
  readonly id = input.required<string>();

  private readonly api = inject(CertificatesApi);
  private readonly navigation = inject(BrowserNavigation);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  protected readonly state = signal<State>({ kind: 'loading' });
  protected readonly busy = signal(false);
  protected readonly name = bodyName;
  protected readonly date = ukDate;
  protected readonly size = fileSize;
  protected readonly expiry = (iso: string) => expiryNote(iso);

  private get certificateId(): number {
    return Number(this.id());
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    if (this.state().kind !== 'ready') {
      this.state.set({ kind: 'loading' });
    }
    try {
      this.state.set({ kind: 'ready', certificate: await firstValueFrom(this.api.get(this.certificateId)) });
    } catch (error) {
      this.state.set({ kind: isNotFound(error) ? 'notFound' : 'error' });
    }
  }

  protected ingredientNames(certificate: CertificateDetail): string {
    return certificate.ingredients.map((i) => i.name).join(', ');
  }

  /** A fresh 5-minute link each time; the browser downloads it (attachment), the page stays. Never stored. */
  protected async download(): Promise<void> {
    await this.run(async () => {
      const link = await firstValueFrom(this.api.downloadLink(this.certificateId));
      this.navigation.assign(link.url);
    }, 'The PDF could not be downloaded. Please try again.');
  }

  protected async approve(): Promise<void> {
    await this.run(async () => {
      this.state.set({ kind: 'ready', certificate: await firstValueFrom(this.api.approve(this.certificateId)) });
      this.notify('Certificate approved.');
    }, 'The certificate could not be approved. Please try again.');
  }

  protected async reject(): Promise<void> {
    const data: NameDialogData = {
      title: 'Reject certificate', label: 'Reason', value: '', maxLength: 500, requiredMessage: 'Enter the reason.',
      save: (reason) => this.api.reject(this.certificateId, reason),
    };
    const rejected = await firstValueFrom(this.dialog.open(NameDialog, { data, width: '480px', maxWidth: 'calc(100vw - 32px)' }).afterClosed());
    if (rejected) {
      await this.load();
      this.notify('Certificate rejected.');
    }
  }

  protected async edit(certificate: CertificateDetail): Promise<void> {
    const data: CertificateDialogData = { certificate };
    const saved = await firstValueFrom(this.dialog.open<CertificateDialog, CertificateDialogData, CertificateDetail>(CertificateDialog, {
      data, autoFocus: 'first-tabbable', width: '640px', maxWidth: 'calc(100vw - 32px)',
    }).afterClosed());
    if (saved) {
      this.state.set({ kind: 'ready', certificate: saved });
      this.notify('Certificate saved.');
    }
  }

  protected async deleteCertificate(): Promise<void> {
    const data: ConfirmDialogData = { title: 'Delete this certificate?', message: 'The certificate and its PDF are deleted for everyone in your company.', confirmLabel: 'Delete certificate' };
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialog, { data, width: '440px', maxWidth: 'calc(100vw - 32px)' }).afterClosed());
    if (confirmed !== true) {
      return;
    }
    await this.run(async () => {
      await firstValueFrom(this.api.remove(this.certificateId));
      await this.router.navigate(['/certificates']);
      this.notify('Certificate deleted.');
    }, 'The certificate could not be deleted. Please try again.');
  }

  private async run(action: () => Promise<void>, fallback: string): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await action();
    } catch (error) {
      if (isNotFound(error)) {
        await this.load();
        if (this.state().kind === 'ready') {
          this.snackBar.open('Someone else changed this just now. The page is up to date again.', 'Close', { duration: 6000 });
        }
      } else {
        this.snackBar.open(errorMessage(error, fallback), 'Close', { duration: 6000 });
      }
    } finally {
      this.busy.set(false);
    }
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Close', { duration: 4000 });
  }
}
