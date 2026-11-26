import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DashboardApi } from '../../core/api/dashboard-api';
import { AuthService } from '../../core/auth/auth.service';
import { ComplianceStatus } from '../../core/models/compliance';
import { DashboardCertificates, DashboardChange, DashboardData } from '../../core/models/dashboard';
import { MarketOption } from '../../core/models/markets';
import { ukDate, ukDateTime } from '../../shared/format/uk-date';
import { EmptyState } from '../../shared/ui/empty-state';
import { ComplianceMatrix } from '../compliance/compliance-matrix';
import { MarketsDialog } from '../markets/markets-dialog';
import { OnboardingCard } from './onboarding-card';

import { Skeleton } from '../../shared/ui/skeleton';
import { AreaChart, Sparkline } from '../../shared/ui/charts';
import { onLiveChange } from '../../core/live/live-changes';
type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: DashboardData };

@Component({
  selector: 'hs-dashboard',
  imports: [Skeleton, Sparkline, AreaChart,
    MatButtonModule, MatCardModule, MatChipsModule, MatIconModule, RouterLink, EmptyState, OnboardingCard, ComplianceMatrix,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(DashboardApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly statuses: readonly ComplianceStatus[] = ['red', 'amber', 'green'];
  /** Same words as the status badges; the short form heads the narrow count columns. */
  protected readonly statusLabel: Record<ComplianceStatus, string> = { red: 'Action needed', amber: 'Valid · expires soon', green: 'Compliant' };
  protected readonly statusShort: Record<ComplianceStatus, string> = { red: 'Action', amber: 'Expiring', green: 'Compliant' };
  /** The four numbers at the top (14 Nov 2026): the good news first. */
  protected readonly kpiOrder: readonly ComplianceStatus[] = ['green', 'amber', 'red'];
  protected readonly kpiLabel: Record<ComplianceStatus, string> = { green: 'Compliant', amber: 'Expiring soon', red: 'Action needed' };
  protected readonly date = ukDate;
  protected readonly dateTime = ukDateTime;

  protected readonly state = signal<State>({ kind: 'loading' });
  protected readonly liveRefresh = onLiveChange(() => void this.load()); // keeps the data on screen while refreshing
  protected readonly allStepsDone = computed(() => {
    const s = this.state();
    return s.kind === 'ready' && s.data.onboarding.steps.every((step) => step.status === 'done');
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    // Keep showing the current data while refreshing (e.g. after saving markets); spinner only on first load/retry.
    if (this.state().kind !== 'ready') {
      this.state.set({ kind: 'loading' });
    }
    const refreshing = this.state().kind === 'ready';
    try {
      this.state.set({ kind: 'ready', data: await firstValueFrom(this.api.get()) });
    } catch {
      if (refreshing) {
        // Keep the numbers on screen; the change itself was saved.
        this.snackBar.open('Saved, but the dashboard could not be refreshed. Reload the page to see the latest numbers.', 'Close', { duration: 6000 });
      } else {
        this.state.set({ kind: 'error' });
      }
    }
  }

  async chooseMarkets(): Promise<void> {
    const ref = this.dialog.open<MarketsDialog, void, readonly MarketOption[]>(MarketsDialog, {
      autoFocus: 'first-tabbable',
      width: '560px',
      maxWidth: 'calc(100vw - 32px)',
    });
    const saved = await firstValueFrom(ref.afterClosed());
    if (saved) {
      this.snackBar.open('Markets saved.', 'Close', { duration: 4000 });
      await this.load();
    }
  }

  protected marketName(code: string): string {
    const s = this.state();
    const market = s.kind === 'ready' ? s.data.markets.find((m) => m.code === code) : undefined;
    return market ? `${market.market} · ${market.authority}` : code;
  }

  /** A summary number filters the matrix (through the URL), then the page glides down to the filtered table. */
  protected showStatus(market: string | null, status: ComplianceStatus): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { market, status, page: null }, queryParamsHandling: 'merge' })
      .then(() => setTimeout(() => document.getElementById('matrix')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })));
  }

  /** "▲ 2 more in 12 weeks" from a weekly series (oldest first). */
  protected deltaText(series: readonly number[]): string {
    const diff = (series.at(-1) ?? 0) - (series[0] ?? 0);
    if (diff === 0) return 'No change in 12 weeks';
    return `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} in 12 weeks`;
  }

  /** Green when the change is good: more products or compliant ones, fewer expiring or failing ones. */
  protected deltaTone(series: readonly number[], fewerIsBetter: boolean): string {
    const diff = (series.at(-1) ?? 0) - (series[0] ?? 0);
    if (diff === 0) return 'is-flat';
    return (diff > 0) !== fewerIsBetter ? 'is-good' : 'is-bad';
  }

  protected certificateTotal(c: DashboardCertificates): number {
    return c.valid + c.expiring + c.expired + c.pending;
  }

  protected certificateRows(c: DashboardCertificates): { key: string; label: string; value: number; percent: number; tone: string }[] {
    const max = Math.max(1, c.valid, c.expiring, c.expired, c.pending);
    return [
      { key: 'valid', label: 'Valid', value: c.valid, tone: 'green' },
      { key: 'expiring', label: 'Expiring in 60 days', value: c.expiring, tone: 'amber' },
      { key: 'expired', label: 'Expired', value: c.expired, tone: 'red' },
      { key: 'pending', label: 'Waiting for review', value: c.pending, tone: 'primary' },
    ].map((r) => ({ ...r, percent: (r.value / max) * 100 }));
  }

  protected changeTitle(ch: DashboardChange): string {
    switch (ch.status) {
      case 'green': return 'Now compliant';
      case 'amber': return 'Expires soon';
      case 'red': return ch.reason ?? 'Action needed';
      default: return 'No longer tracked';
    }
  }

  protected marketShort(code: string): string {
    const s = this.state();
    return (s.kind === 'ready' ? s.data.markets.find((m) => m.code === code)?.market : undefined) ?? code;
  }

  /** 10:42 today, "Yesterday", otherwise "29 Sep" (UK time). */
  protected when(iso: string, now: Date = new Date()): string {
    const day = (d: Date): string => d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
    const at = new Date(iso);
    if (day(at) === day(now)) return at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    if (day(at) === day(new Date(now.getTime() - 86_400_000))) return 'Yesterday';
    return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });
  }

  protected daysText(days: number): string {
    return days === 0 ? 'today' : `${days} ${days === 1 ? 'day' : 'days'}`;
  }
}
