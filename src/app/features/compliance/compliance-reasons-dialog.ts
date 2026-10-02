import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ComplianceApi } from '../../core/api/compliance-api';
import { AuthService } from '../../core/auth/auth.service';
import { MarketBreakdown } from '../../core/models/compliance';
import { AuthorityCode } from '../../core/models/markets';
import { ComplianceBreakdown } from './compliance-breakdown';

export interface ComplianceReasonsDialogData {
  readonly productId: number;
  readonly productName: string;
  readonly market: AuthorityCode | null;
}

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; markets: readonly MarketBreakdown[] };

/** Opened by tapping a matrix cell: works on touch screens, where tooltips do not. */
@Component({
  selector: 'hs-compliance-reasons-dialog',
  imports: [RouterLink, MatButtonModule, MatDialogModule, MatProgressBarModule, ComplianceBreakdown],
  template: `
    <h2 mat-dialog-title>Why? · {{ data.productName }}</h2>
    <mat-dialog-content>
      @let s = state();
      @if (s.kind === 'loading') {
        <mat-progress-bar mode="indeterminate" aria-label="Loading the reasons" />
      } @else if (s.kind === 'error') {
        <p role="alert">We couldn't load the reasons.</p>
        <button mat-stroked-button type="button" class="btn" (click)="load()">Try again</button>
      } @else {
        <hs-compliance-breakdown [markets]="s.markets" [market]="data.market" [canManage]="auth.canManageTeam()" (changed)="load()" />
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <a mat-button class="btn" [routerLink]="['/products', data.productId]" mat-dialog-close>Open product</a>
      <button mat-flat-button type="button" class="btn" mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: `.btn { min-height: 44px; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComplianceReasonsDialog implements OnInit {
  protected readonly data = inject<ComplianceReasonsDialogData>(MAT_DIALOG_DATA);
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ComplianceApi);

  protected readonly state = signal<State>({ kind: 'loading' });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    if (this.state().kind !== 'ready') {
      this.state.set({ kind: 'loading' });
    }
    try {
      this.state.set({ kind: 'ready', markets: await firstValueFrom(this.api.product(this.data.productId)) });
    } catch {
      this.state.set({ kind: 'error' });
    }
  }
}
