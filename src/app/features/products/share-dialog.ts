import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ShareLinksApi } from '../../core/api/share-links-api';
import { AuthorityCode, marketLabel } from '../../core/models/markets';
import { ShareLinkItem } from '../../core/models/share-links';
import { ukDate } from '../../shared/format/uk-date';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/ui/confirm-dialog';

export interface ShareDialogData {
  readonly productId: number;
  readonly productName: string;
  readonly markets: readonly AuthorityCode[];
}

/**
 * 16 Nov 2026 (Bilal, week 2): "Share with a buyer". One read-only link per market: the buyer sees the product's status,
 * ingredients, certifiers and certificate dates for that market (no files), always up to date, for 30 days.
 */
@Component({
  selector: 'hs-share-dialog',
  // The dialog parts only (not MatDialogModule, which would bring its own MatDialog for the confirm step).
  imports: [MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Share with a buyer</h2>
    <mat-dialog-content class="share">
      <p class="muted">Send a buyer or importer a read-only page with the halal compliance of <strong>{{ data.productName }}</strong> for one market.
        It updates by itself, shows no certificate files and works for 30 days.</p>
      @if (error(); as message) { <p class="notice notice--error" role="alert" data-test="share-error">{{ message }}</p> }
      @if (created(); as c) {
        <div class="created" data-test="created">
          <mat-form-field appearance="outline">
            <mat-label>Link for {{ label(c.market) }}</mat-label>
            <input matInput [value]="c.url" readonly data-test="share-url" (focus)="$any($event.target).select()" />
          </mat-form-field>
          <div class="created__row">
            <button mat-flat-button type="button" class="btn" (click)="copyUrl(c.url)" data-test="copy-new">Copy link</button>
            @if (copied()) { <span class="muted" role="status" data-test="copied">Link copied</span> }
          </div>
        </div>
      }
      <ul class="markets">
        @for (market of data.markets; track market) {
          @let link = openLink(market);
          <li class="market" [attr.data-test]="'share-' + market">
            <div class="market__text">
              <strong>{{ label(market) }}</strong>
              @if (link) {
                <span class="muted market__meta">Shared · works until {{ date(link.expires_at) }} · viewed {{ link.views_count }} {{ link.views_count === 1 ? 'time' : 'times' }}</span>
              } @else {
                <span class="muted market__meta">Not shared</span>
              }
            </div>
            <div class="market__actions">
              @if (link) {
                <button mat-stroked-button type="button" class="btn" (click)="copyExisting(link)" [disabled]="busy()" data-test="copy">Copy link</button>
                <button mat-button type="button" class="btn" (click)="stop(link)" [disabled]="busy()" data-test="stop">Stop sharing</button>
              } @else {
                <button mat-flat-button type="button" class="btn" (click)="create(market)" [disabled]="busy()" data-test="create">Create link</button>
              }
            </div>
          </li>
        }
      </ul>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" class="btn" mat-dialog-close>Done</button>
    </mat-dialog-actions>
  `,
  styles: `
    .share { display: grid; gap: var(--space-3); min-width: min(100%, var(--container-form)); }
    .created { display: grid; gap: var(--space-2); }
    .created mat-form-field { width: 100%; }
    .created__row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
    .markets { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
    .market { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2);
      padding: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
    .market__text { display: grid; gap: var(--space-1); }
    .market__meta { font-size: var(--text-sm); }
    .market__actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .btn { min-height: var(--touch-target); }
    .notice { margin: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareDialog implements OnInit {
  protected readonly data = inject<ShareDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(ShareLinksApi);
  private readonly clipboard = inject(Clipboard);
  private readonly dialog = inject(MatDialog);

  protected readonly links = signal<readonly ShareLinkItem[]>([]);
  protected readonly created = signal<{ market: AuthorityCode; url: string } | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly copied = signal(false);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      this.links.set(await firstValueFrom(this.api.list(this.data.productId)));
    } catch {
      this.error.set('The links could not be loaded. Please try again.');
    }
  }

  protected openLink(market: AuthorityCode): ShareLinkItem | undefined {
    return this.links().find((l) => l.market === market);
  }

  protected label(market: AuthorityCode): string {
    return marketLabel(market);
  }

  protected date(iso: string): string {
    return ukDate(iso);
  }

  async create(market: AuthorityCode): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const link = await firstValueFrom(this.api.create(this.data.productId, market));
      this.created.set({ market, url: link.url });
      this.copied.set(false);
      await this.load();
    } catch (error) {
      // 422 plan_limit opens the upgrade dialog (shared error handler); other 422s carry a message.
      if (error instanceof HttpErrorResponse && error.status === 422 && error.error?.code !== 'plan_limit') {
        this.error.set(error.error?.message ?? 'This link could not be created.');
      } else if (!(error instanceof HttpErrorResponse) || error.status !== 422) {
        this.error.set('The link could not be created. Please try again.');
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected copyUrl(url: string): void {
    const ok = this.clipboard.copy(url);
    this.copied.set(ok);
    this.error.set(ok ? null : 'The link could not be copied. Select it and copy it yourself.');
  }

  async copyExisting(link: ShareLinkItem): Promise<void> {
    this.busy.set(true);
    try {
      const url = await firstValueFrom(this.api.link(link.id));
      this.created.set({ market: link.market, url });
      this.copyUrl(url);
    } catch {
      this.error.set('The link could not be copied. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }

  async stop(link: ShareLinkItem): Promise<void> {
    const data: ConfirmDialogData = { title: 'Stop sharing?', message: `The buyer's link for ${this.label(link.market)} will stop working at once.`, confirmLabel: 'Stop sharing' };
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialog, { data, width: '440px', maxWidth: 'calc(100vw - 32px)' }).afterClosed());
    if (confirmed !== true) {
      return;
    }
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.stop(link.id));
      if (this.created()?.market === link.market) {
        this.created.set(null);
      }
      await this.load();
    } catch {
      this.error.set('The link could not be stopped. Please try again.');
    } finally {
      this.busy.set(false);
    }
  }
}
