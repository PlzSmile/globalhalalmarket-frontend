import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DashboardApi } from '../../core/api/dashboard-api';
import { AuthService } from '../../core/auth/auth.service';
import { ComplianceStatus } from '../../core/models/compliance';
import { DashboardData } from '../../core/models/dashboard';
import { MarketOption } from '../../core/models/markets';
import { ukDate, ukDateTime } from '../../shared/format/uk-date';
import { EmptyState } from '../../shared/ui/empty-state';
import { StatusBadge } from '../../shared/ui/status-badge';
import { ComplianceMatrix } from '../compliance/compliance-matrix';
import { MarketsDialog } from '../markets/markets-dialog';
import { OnboardingCard } from './onboarding-card';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: DashboardData };

@Component({
  selector: 'hs-dashboard',
  imports: [
    MatButtonModule, MatCardModule, MatChipsModule, MatIconModule, MatProgressBarModule, RouterLink, EmptyState, OnboardingCard, StatusBadge, ComplianceMatrix,
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
  protected readonly date = ukDate;
  protected readonly dateTime = ukDateTime;

  protected readonly state = signal<State>({ kind: 'loading' });
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
    try {
      this.state.set({ kind: 'ready', data: await firstValueFrom(this.api.get()) });
    } catch {
      this.state.set({ kind: 'error' });
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

  /** A summary number filters the matrix (through the URL) and scrolls to it. */
  protected showStatus(market: string | null, status: ComplianceStatus): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { market, status, page: null }, queryParamsHandling: 'merge' });
    document.getElementById('matrix')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  protected daysText(days: number): string {
    return days === 0 ? 'today' : `${days} ${days === 1 ? 'day' : 'days'}`;
  }
}
