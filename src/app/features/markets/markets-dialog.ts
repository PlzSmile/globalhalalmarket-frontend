import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MarketsApi } from '../../core/api/markets-api';
import { MarketOption } from '../../core/models/markets';
import { MarketPicker } from './market-picker';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; markets: readonly MarketOption[] };

@Component({
  selector: 'hs-markets-dialog',
  imports: [MatButtonModule, MatDialogModule, MatProgressBarModule, MarketPicker],
  template: `
    <h2 mat-dialog-title>Choose your export markets</h2>
    <mat-dialog-content>
      <p class="muted intro">Tick every market you ship halal products to. You can change this later in Settings.</p>
      @let s = state();
      @if (s.kind === 'loading') {
        <mat-progress-bar mode="indeterminate" aria-label="Loading markets" />
      } @else if (s.kind === 'error') {
        <p class="notice notice--error" role="alert">Markets could not be loaded.</p>
        <button mat-stroked-button type="button" (click)="load()" data-test="retry-markets">Try again</button>
      } @else {
        <hs-market-picker [markets]="s.markets" (saved)="onSaved($event)">
          <button pickerCancel mat-button type="button" mat-dialog-close>Cancel</button>
        </hs-market-picker>
      }
    </mat-dialog-content>
    @if (state().kind !== 'ready') {
      <mat-dialog-actions align="end"><button mat-button type="button" mat-dialog-close>Cancel</button></mat-dialog-actions>
    }
  `,
  styles: `.intro { margin-bottom: var(--space-4); }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketsDialog implements OnInit {
  private readonly api = inject(MarketsApi);
  private readonly dialogRef = inject<MatDialogRef<MarketsDialog, readonly MarketOption[]>>(MatDialogRef);
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
    this.dialogRef.close(markets);
  }
}
