import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CertificatesApi } from '../../core/api/certificates-api';
import { BreakdownCertificate, ComplianceStatus, MarketBreakdown, ScopeCheck } from '../../core/models/compliance';
import { AuthorityCode } from '../../core/models/markets';
import { errorMessage } from '../../shared/forms/error-message';
import { ukDate } from '../../shared/format/uk-date';
import { StatusBadge } from '../../shared/ui/status-badge';
import { statusDetail } from './compliance-format';
import { ScopeCheckDialog, ScopeCheckDialogData } from './scope-check-dialog';
import { marketLabel } from '../../core/models/markets';

let nextId = 0;

/** The "Why?" view: per market, the reasons, each ingredient and its certificates with both scope texts. */
@Component({
  selector: 'hs-compliance-breakdown',
  imports: [RouterLink, MatButtonModule, StatusBadge],
  template: `
    @for (m of visible(); track m.market) {
      <section class="market" [class]="'market market--' + m.market" [attr.aria-labelledby]="uid + '-' + m.market">
        <header class="market__top">
          <h3 class="market__title" [id]="uid + '-' + m.market">{{ label(m.market) }}</h3>
          @if (m.status; as status) { <hs-status-badge [status]="status" [detail]="detail(status, m.next_expiry_on)" /> } @else { <span class="muted">Not calculated yet</span> }
        </header>
        @let marketReasons = shown(m.reasons);
        @if (marketReasons.length) {
          <ul class="reasons">@for (r of marketReasons; track $index) { <li>{{ r }}</li> }</ul>
        }
        <ul class="ingredients">
          @for (i of m.ingredients; track i.id) {
            <li class="ingredient">
              <div class="ingredient__top">
                <span class="ingredient__name">{{ i.name }}</span>
                @if (i.status; as status) { <hs-status-badge [status]="status" /> }
              </div>
              @let reasons = shown(i.reasons);
              @if (reasons.length) {
                <ul class="reasons reasons--small">@for (r of reasons; track $index) { <li>{{ r }}</li> }</ul>
              }
              @for (c of i.certificates; track c.id) {
                <div class="cert" data-test="certificate">
                  <p class="cert__title"><a [routerLink]="['/certificates', c.id]">{{ c.body }}</a> · {{ c.supplier }} · expires {{ date(c.expires_on) }}</p>
                  <dl class="scopes">
                    <div><dt>Certificate scope</dt><dd>{{ c.scope ?? 'Not given on the certificate' }}</dd></div>
                    <div><dt>{{ m.authority }} scope</dt><dd>{{ scopes(c) }}</dd></div>
                  </dl>
                  <p class="decision" data-test="decision">{{ decision(c.scope_check) }}</p>
                  @if (canManage()) {
                    <div class="actions">
                      <button mat-stroked-button type="button" class="btn" (click)="check(m, c)" [disabled]="busy()" data-test="check-scope">{{ c.scope_check ? 'Change decision' : 'Check scope' }}</button>
                      @if (c.scope_check) { <button mat-button type="button" class="btn" (click)="clear(m, c)" [disabled]="busy()" data-test="clear-scope">Clear</button> }
                    </div>
                  }
                </div>
              }
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    :host { display: grid; gap: var(--space-4); }
    /* 3 Nov 2026: each market is its own panel with the market's colour on the left; its ingredients sit in two columns. */
    .market { display: grid; gap: var(--space-3); padding: var(--space-4); border-radius: var(--radius-lg);
      border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent); border-left: 4px solid var(--market-colour, var(--color-primary));
      background: var(--color-surface); }
    .market--BPJPH { --market-colour: var(--market-id); }
    .market--JAKIM { --market-colour: var(--market-my); }
    .market--MOIAT { --market-colour: var(--market-ae); }
    .market__top, .ingredient__top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2); }
    .market__title { font-size: var(--text-lg); margin: 0; }
    .reasons { margin: 0; padding-inline-start: var(--space-5); display: grid; gap: var(--space-1); }
    .reasons--small { font-size: var(--text-sm); color: var(--color-text-muted); }
    .ingredients { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
    @media (min-width: 1200px) { .ingredients { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .ingredient { display: grid; gap: var(--space-2); align-content: start; padding: var(--space-3); border-radius: var(--radius-md);
      border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent); background: color-mix(in srgb, var(--color-surface-muted) 45%, var(--color-surface)); }
    .ingredient__name { font-weight: var(--weight-semibold); }
    .cert { display: grid; gap: var(--space-2); padding: var(--space-3); border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent); border-radius: var(--radius-md); background: var(--color-surface); }
    .cert__title { margin: 0; font-size: var(--text-sm); }
    .cert__title a { display: inline-flex; align-items: center; min-height: var(--touch-target); }
    .scopes { display: grid; gap: var(--space-2); margin: 0; grid-template-columns: minmax(0, 1fr); }
    .scopes dt { color: var(--color-text-subtle); font-size: var(--text-xs); }
    .scopes dd { margin: 0; font-size: var(--text-sm); }
    @media (min-width: 768px) { .scopes { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .decision { margin: 0; font-size: var(--text-sm); }
    .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .btn { min-height: var(--touch-target); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComplianceBreakdown {
  readonly markets = input.required<readonly MarketBreakdown[]>();
  protected readonly label = marketLabel;

  /** Show only this market (the matrix cell that was tapped). */
  readonly market = input<AuthorityCode | null>(null);
  readonly canManage = input(false);
  /** A scope decision changed: the parent reloads (compliance was recalculated). */
  readonly changed = output<void>();

  private readonly api = inject(CertificatesApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly uid = `hs-breakdown-${++nextId}`;
  protected readonly busy = signal(false);
  protected readonly visible = computed(() => {
    const only = this.market();
    return only ? this.markets().filter((m) => m.market === only) : this.markets();
  });
  protected readonly date = ukDate;

  protected detail(status: ComplianceStatus, next: string | null): string | null {
    return statusDetail(status, next);
  }

  /** Reasons worth reading: "scope not checked" lines are left out (Bilal, 3 Nov 2026); each certificate box still says it. */
  protected shown(reasons: readonly string[]): readonly string[] {
    return reasons.filter((r) => !/scope not checked/i.test(r));
  }

  protected scopes(certificate: BreakdownCertificate): string {
    return certificate.authority_scopes?.length ? certificate.authority_scopes.join(', ') : 'Not published by the authority';
  }

  protected decision(check: ScopeCheck | null): string {
    if (!check) {
      return 'Scope not checked yet';
    }
    const what = check.result === 'covers' ? 'Scope covers this market' : 'Scope does not cover this market';
    return `${what} — ${check.by ?? 'Someone'}, ${ukDate(check.at)}${check.note ? ` · “${check.note}”` : ''}`;
  }

  protected async check(market: MarketBreakdown, certificate: BreakdownCertificate): Promise<void> {
    const data: ScopeCheckDialogData = { certificateId: certificate.id, authorityCode: market.market, authority: market.authority, current: certificate.scope_check };
    const saved = await firstValueFrom(this.dialog.open<ScopeCheckDialog, ScopeCheckDialogData, ScopeCheck>(ScopeCheckDialog, {
      data, autoFocus: 'first-tabbable', width: '520px', maxWidth: 'calc(100vw - 32px)',
    }).afterClosed());
    if (saved) {
      this.snackBar.open('Scope decision saved.', 'Close', { duration: 4000 });
      this.changed.emit();
    }
  }

  protected async clear(market: MarketBreakdown, certificate: BreakdownCertificate): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.clearScopeCheck(certificate.id, market.market));
      this.snackBar.open('Scope decision cleared.', 'Close', { duration: 4000 });
      this.changed.emit();
    } catch (error) {
      this.snackBar.open(errorMessage(error, 'The decision could not be cleared. Please try again.'), 'Close', { duration: 6000 });
    } finally {
      this.busy.set(false);
    }
  }
}
