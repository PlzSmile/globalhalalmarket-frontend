import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule, MatProgressSpinnerModule, CertificateStatusBadge],
  template: `
    <a routerLink="/certificates" class="back">← All certificates</a>
    @let s = state();
    @if (s.kind === 'loading') {
      <mat-progress-bar mode="indeterminate" aria-label="Loading certificate" />
    } @else if (s.kind === 'notFound') {
      <mat-card appearance="outlined" class="hs-card"><mat-card-content class="load-error">
        <h1 class="card-title">Certificate not found</h1>
        <p class="muted">It may have been removed, or the link is wrong.</p>
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
          @switch (c.file.scan) {
            @case ('pending') {
              <div class="notice notice--info scan" role="status" data-test="scan-pending">
                @if (scanWatching()) {
                  <p>Checking the file for viruses… {{ scanSecondsLeft() > 0 ? 'about ' + scanSecondsLeft() + ' seconds left' : 'almost done, it is taking a little longer than usual' }}</p>
                  <mat-progress-bar mode="determinate" [value]="scanProgress()" aria-label="Virus check progress" />
                  <p class="scan__hint">This page updates by itself. You can leave it and come back later.</p>
                } @else {
                  <p>The virus check is taking longer than usual. Please check again in a few minutes.</p>
                }
              </div>
            }
            @case ('infected') { <p class="notice notice--error" data-test="scan-infected">The file failed the virus check and was deleted. Ask the supplier for a new copy.</p> }
            @case ('failed') { <p class="notice notice--warning" data-test="scan-failed">The file could not be checked for viruses, so it cannot be opened yet. We have been told and are looking into it.</p> }
          }
          @if (c.archived_at) { <p class="notice notice--info" data-test="archived">Archived on {{ date(c.archived_at) }}. It no longer counts for compliance.</p> }
        </div>
        <div class="actions">
          @if (fileOpens(c)) {
            <button mat-flat-button type="button" class="btn" (click)="download()" [disabled]="busy() || downloading()" data-test="download">
              @if (downloading()) {
                <mat-progress-spinner class="btn-spinner" mode="indeterminate" diameter="18" aria-hidden="true" />
              } @else {
                <mat-icon svgIcon="file" />
              }
              {{ downloading() ? 'Downloading…' : 'Download PDF' }}
            </button>
          } @else if (c.file.scan === 'pending' && !scanWatching()) {
            <button mat-stroked-button type="button" class="btn" (click)="load()" [disabled]="busy()" data-test="scan-refresh">Check again</button>
          }
          @if (c.archived_at) {
            <button mat-stroked-button type="button" class="btn" (click)="restore()" [disabled]="busy()" data-test="restore">Restore</button>
          } @else {
            @if (c.status !== 'approved') { <button mat-stroked-button type="button" class="btn" (click)="approve()" [disabled]="busy()" data-test="approve">Approve</button> }
            @if (c.status !== 'rejected') { <button mat-stroked-button type="button" class="btn" (click)="reject()" [disabled]="busy()" data-test="reject">Reject</button> }
            <button mat-stroked-button type="button" class="btn" (click)="edit(c)" [disabled]="busy()" data-test="edit">Edit</button>
            <button mat-stroked-button type="button" class="btn" (click)="archiveCertificate()" [disabled]="busy()" data-test="archive">Archive</button>
          }
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
            @if (c.from_upload_link) {
              <dt>Source</dt><dd data-test="from-link">Uploaded by the supplier through an upload link on {{ date(c.created_at) }}</dd>
            }
            @if (c.reviewed_by) { <dt>Reviewed</dt><dd>{{ c.reviewed_by.name }}{{ c.reviewed_at ? ', ' + date(c.reviewed_at) : '' }}</dd> }
            @if (c.rejection_reason) { <dt>Reason</dt><dd>{{ c.rejection_reason }}</dd> }
          </dl>
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: `
    :host { display: grid; gap: var(--space-4); }
    .back { display: inline-flex; align-items: center; min-height: var(--touch-target); }
    .page-top { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
    .page-top__title { font-size: var(--text-3xl); margin-bottom: var(--space-2); }
    .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .btn { min-height: var(--touch-target); }
    .card-title { font-size: var(--text-xl); }
    .facts { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-1) var(--space-4); margin: 0; }
    .facts dt { color: var(--color-text-muted); font-size: var(--text-sm); }
    .facts dd { margin: 0 0 var(--space-3); }
    .facts a { display: inline-flex; align-items: center; min-height: var(--touch-target); }
    @media (min-width: 768px) { .facts { grid-template-columns: 12rem minmax(0, 1fr); } .facts dd { margin: 0; } }
    .note { margin-inline-start: var(--space-2); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
    .note--danger { color: var(--color-danger-fg); }
    .note--warning { color: var(--color-warning-fg); }
    .scan { display: grid; gap: var(--space-2); }
    .scan p { margin: 0; }
    .scan__hint { font-size: var(--text-sm); color: var(--color-text-muted); }
    .btn-spinner { display: inline-block; vertical-align: middle; margin-inline-end: var(--space-2); --mat-progress-spinner-active-indicator-color: currentColor; }
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

  /** Usual time from upload to AWS's virus check result (first check after 20 s; the server worker starts each minute). */
  static readonly SCAN_EXPECTED_SECONDS = 90;
  static readonly SCAN_POLL_MS = 10_000;
  static readonly SCAN_POLL_LIMIT_MS = 10 * 60_000;
  /** The browser handles the file itself, so "Downloading…" shows for a short moment after the link opened. */
  static readonly DOWNLOAD_FEEDBACK_MS = 3_000;

  protected readonly state = signal<State>({ kind: 'loading' });
  protected readonly busy = signal(false);
  protected readonly downloading = signal(false);
  protected readonly scanWatching = signal(false);
  private readonly now = signal(Date.now());
  private readonly destroyRef = inject(DestroyRef);
  private scanTicker: ReturnType<typeof setInterval> | null = null;
  private scanWatchStartedAt = 0;
  private lastScanPollAt = 0;
  private scanPolling = false;

  /** An estimate from the upload time (AWS gives no progress): never shows 100% before the result is there. */
  private readonly scanElapsedSeconds = computed(() => {
    const s = this.state();
    const uploaded = s.kind === 'ready' && s.certificate.created_at ? Date.parse(s.certificate.created_at) : NaN;
    const from = Number.isNaN(uploaded) ? this.scanWatchStartedAt : uploaded;
    return Math.max(0, (this.now() - from) / 1000);
  });
  protected readonly scanProgress = computed(() =>
    Math.min(95, Math.max(5, Math.round((this.scanElapsedSeconds() / CertificateDetailPage.SCAN_EXPECTED_SECONDS) * 100))));
  protected readonly scanSecondsLeft = computed(() => Math.max(0, Math.ceil(CertificateDetailPage.SCAN_EXPECTED_SECONDS - this.scanElapsedSeconds())));
  protected readonly name = bodyName;
  protected readonly date = ukDate;
  protected readonly size = fileSize;
  protected readonly expiry = (iso: string) => expiryNote(iso);

  private get certificateId(): number {
    return Number(this.id());
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.stopScanWatch());
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
    this.watchScan();
  }

  /** While AWS checks the file: a 1-second clock for the progress bar and a quiet re-check every 10 s, up to 10 minutes. */
  private watchScan(): void {
    const s = this.state();
    if (s.kind !== 'ready' || s.certificate.file.scan !== 'pending' || this.scanTicker !== null) {
      return;
    }
    this.scanWatchStartedAt = this.lastScanPollAt = Date.now();
    this.now.set(Date.now());
    this.scanWatching.set(true);
    this.scanTicker = setInterval(() => void this.scanTick(), 1000);
  }

  private async scanTick(): Promise<void> {
    const now = Date.now();
    this.now.set(now);
    if (now - this.scanWatchStartedAt >= CertificateDetailPage.SCAN_POLL_LIMIT_MS) {
      this.stopScanWatch();
      return;
    }
    if (this.scanPolling || now - this.lastScanPollAt < CertificateDetailPage.SCAN_POLL_MS) {
      return;
    }
    this.scanPolling = true;
    this.lastScanPollAt = now;
    try {
      const certificate = await firstValueFrom(this.api.get(this.certificateId));
      if (this.state().kind === 'ready' && this.scanTicker !== null) {
        this.state.set({ kind: 'ready', certificate });
        if (certificate.file.scan !== 'pending') {
          this.stopScanWatch();
          if (certificate.file.scan === 'clean') {
            this.notify('File checked: no viruses found. You can download it now.');
          }
        }
      }
    } catch {
      // a failed re-check is tried again on the next round
    } finally {
      this.scanPolling = false;
    }
  }

  private stopScanWatch(): void {
    if (this.scanTicker !== null) {
      clearInterval(this.scanTicker);
      this.scanTicker = null;
    }
    this.scanWatching.set(false);
  }

  /** Files from before the virus check status (no scan field) were checked during their upload. */
  protected fileOpens(certificate: CertificateDetail): boolean {
    return (certificate.file.scan ?? 'clean') === 'clean';
  }

  protected ingredientNames(certificate: CertificateDetail): string {
    return certificate.ingredients.map((i) => i.name).join(', ');
  }

  /** A fresh 5-minute link each time; the browser downloads it (attachment), the page stays. Never stored. */
  protected async download(): Promise<void> {
    if (this.downloading()) {
      return;
    }
    this.downloading.set(true);
    let started = false;
    await this.run(async () => {
      const link = await firstValueFrom(this.api.downloadLink(this.certificateId));
      if (!link.url.startsWith('/files/certificates/')) {
        throw new Error('Unexpected download link'); // never navigate anywhere else
      }
      this.navigation.assign(link.url);
      started = true;
    }, 'The PDF could not be downloaded. Please try again.');
    if (started) {
      setTimeout(() => this.downloading.set(false), CertificateDetailPage.DOWNLOAD_FEEDBACK_MS);
    } else {
      this.downloading.set(false);
    }
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

  protected async archiveCertificate(): Promise<void> {
    const data: ConfirmDialogData = {
      title: 'Archive this certificate?',
      message: 'It is hidden from lists and no longer counts for compliance. The PDF and its details are kept, and you can restore it.',
      confirmLabel: 'Archive certificate',
    };
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialog, { data, width: '440px', maxWidth: 'calc(100vw - 32px)' }).afterClosed());
    if (confirmed !== true) {
      return;
    }
    await this.run(async () => {
      await firstValueFrom(this.api.archive(this.certificateId));
      await this.router.navigate(['/certificates']);
      this.notify('Certificate archived.');
    }, 'The certificate could not be archived. Please try again.');
  }

  protected async restore(): Promise<void> {
    await this.run(async () => {
      this.state.set({ kind: 'ready', certificate: await firstValueFrom(this.api.restore(this.certificateId)) });
      this.notify('Certificate restored.');
    }, 'The certificate could not be restored. Please try again.');
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
