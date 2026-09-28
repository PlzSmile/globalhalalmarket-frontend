import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DashboardApi } from '../../core/api/dashboard-api';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardData } from '../../core/models/dashboard';
import { MarketOption } from '../../core/models/markets';
import { EmptyState } from '../../shared/ui/empty-state';
import { MarketsDialog } from '../markets/markets-dialog';
import { OnboardingCard } from './onboarding-card';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: DashboardData };

@Component({
  selector: 'hs-dashboard',
  imports: [
    MatButtonModule, MatCardModule, MatChipsModule, MatIconModule, MatProgressBarModule, MatTooltipModule, EmptyState, OnboardingCard,
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
}
