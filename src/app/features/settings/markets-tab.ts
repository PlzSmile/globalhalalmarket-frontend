import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MarketsApi } from '../../core/api/markets-api';
import { AuthService } from '../../core/auth/auth.service';
import { MarketOption } from '../../core/models/markets';
import { MarketPicker } from '../markets/market-picker';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; markets: readonly MarketOption[] };

@Component({
  selector: 'hs-markets-tab',
  imports: [MatButtonModule, MatCardModule, MatProgressBarModule, MarketPicker],
  template: `
    <div class="settings-grid">
      <mat-card appearance="outlined" class="hs-card">
        <mat-card-header><mat-card-title>Export markets</mat-card-title></mat-card-header>
        <mat-card-content>
          <p class="muted">The authorities whose recognition we check for your products.</p>
          @if (!auth.canManageTeam()) { <p class="notice notice--info">Only owners and admins can change markets.</p> }
          @let s = state();
          @if (s.kind === 'loading') {
            <mat-progress-bar mode="indeterminate" aria-label="Loading markets" />
          } @else if (s.kind === 'error') {
            <p class="notice notice--error" role="alert">Markets could not be loaded.</p>
            <button mat-stroked-button type="button" (click)="load()">Try again</button>
          } @else {
            <hs-market-picker [markets]="s.markets" [readonly]="!auth.canManageTeam()" (saved)="onSaved($event)" />
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketsTab implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(MarketsApi);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly state = signal<State>({ kind: 'loading' });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.state.set({ kind: 'loading' });
    try {
      this.state.set({ kind: 'ready', markets: await firstValueFrom(this.api.list()) });
    } catch {
      this.state.set({ kind: 'error' });
    }
  }

  onSaved(markets: readonly MarketOption[]): void {
    this.state.set({ kind: 'ready', markets });
    this.snackBar.open('Markets saved.', 'Close', { duration: 4000 });
  }
}
