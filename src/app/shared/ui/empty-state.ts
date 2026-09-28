import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Friendly "nothing here yet" block with an optional action (projected content). Reused by later phases. */
@Component({
  selector: 'hs-empty-state',
  imports: [MatIconModule],
  template: `
    <section class="empty">
      <span class="empty__icon" aria-hidden="true"><mat-icon [svgIcon]="icon()" /></span>
      <h2 class="empty__title">{{ heading() }}</h2>
      @if (text()) { <p class="empty__text">{{ text() }}</p> }
      <div class="empty__action"><ng-content /></div>
    </section>
  `,
  styles: `
    .empty { display: grid; justify-items: center; gap: var(--space-3); text-align: center;
      padding: var(--space-10) var(--space-6); border: 1px dashed var(--color-border-strong); border-radius: var(--radius-lg);
      background: var(--color-surface); }
    .empty__icon { display: grid; place-items: center; width: 56px; height: 56px; border-radius: var(--radius-pill);
      background: var(--color-primary-soft); color: var(--color-primary); }
    .empty__title { font-size: var(--text-xl); }
    .empty__text { color: var(--color-text-muted); max-width: 48ch; }
    .empty__action:empty { display: none; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly icon = input('box');
  // Not called "title": a static title="…" attribute would also stay on the element as a browser tooltip.
  readonly heading = input.required<string>();
  readonly text = input('');
}
