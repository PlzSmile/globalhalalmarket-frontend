import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

/** Placeholder for sections built in later milestones. Title comes from the route's data. */
@Component({
  selector: 'hs-coming-soon',
  imports: [RouterLink, MatButtonModule, MatCardModule],
  template: `
    <mat-card appearance="outlined" class="hs-card">
      <mat-card-content class="empty">
        <h1 class="empty__title">{{ title() }}</h1>
        <p class="muted">This section is part of the supplier tracker milestone and will be available soon.</p>
        <a mat-stroked-button routerLink="/dashboard">Back to dashboard</a>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .empty { display: grid; justify-items: center; gap: var(--space-4); text-align: center; padding: var(--space-12) var(--space-4) !important; }
    .empty__title { font-size: var(--text-2xl); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoon {
  readonly title = input('Coming soon');
}
