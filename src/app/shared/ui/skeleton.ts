import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SkeletonKind = 'dashboard' | 'table' | 'detail' | 'list';

/**
 * Grey placeholder shapes with a soft shimmer while a screen loads (Bilal, 3 Nov 2026), so the page keeps its shape
 * instead of jumping. One element tells screen readers what is loading (role="status").
 */
@Component({
  selector: 'hs-skeleton',
  template: `
    <span class="visually-hidden">{{ label() }}</span>
    @switch (kind()) {
      @case ('dashboard') {
        <div class="sk-grid sk-grid--3">
          @for (i of three; track i) { <div class="sk-card sk-card--tile"><span class="sk sk--line sk--w50"></span><span class="sk sk--circle"></span></div> }
        </div>
        <div class="sk-grid sk-grid--2">
          <div class="sk-card">@for (i of rows(); track i) { <span class="sk sk--row"></span> }</div>
          <div class="sk-card">@for (i of three; track i) { <span class="sk sk--line"></span><span class="sk sk--line sk--w60"></span> }</div>
        </div>
      }
      @case ('detail') {
        <div class="sk-grid sk-grid--2">
          @for (i of two; track i) {
            <div class="sk-card">
              <span class="sk sk--title"></span>
              @for (r of rows(); track r) { <span class="sk sk--line" [class.sk--w60]="r % 2 === 1"></span> }
            </div>
          }
        </div>
      }
      @case ('list') {
        <div class="sk-card sk-card--flat">@for (i of rows(); track i) { <span class="sk sk--line" [class.sk--w60]="i % 3 === 2"></span> }</div>
      }
      @default {
        <div class="sk-card">
          <span class="sk sk--head"></span>
          @for (i of rows(); track i) { <span class="sk sk--row"></span> }
        </div>
      }
    }
  `,
  host: { role: 'status', 'aria-live': 'polite' },
  styles: `
    :host { display: grid; gap: var(--space-4); }
    .sk-grid { display: grid; gap: var(--space-4); }
    @media (min-width: 768px) { .sk-grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (min-width: 1200px) { .sk-grid--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .sk-card { display: grid; gap: var(--space-3); padding: var(--space-4); border-radius: var(--radius-lg);
      background: var(--color-surface); box-shadow: var(--shadow-card); }
    .sk-card--flat { box-shadow: none; padding: 0; background: transparent; }
    .sk-card--tile { display: flex; align-items: center; justify-content: space-between; min-height: 5rem; }
    .sk {
      display: block; border-radius: var(--radius-sm);
      background: linear-gradient(90deg, var(--color-surface-muted) 25%, color-mix(in srgb, var(--color-surface-muted) 40%, var(--color-surface)) 50%, var(--color-surface-muted) 75%);
      background-size: 200% 100%;
      animation: hs-shimmer 1.4s ease-in-out infinite;
    }
    .sk--line { height: 0.8rem; width: 100%; }
    .sk--w50 { width: 50%; }
    .sk--w60 { width: 60%; }
    .sk--title { height: 1.2rem; width: 40%; margin-bottom: var(--space-1); }
    .sk--head { height: 2.25rem; }
    .sk--row { height: 2.75rem; }
    .sk--circle { width: 3.25rem; height: 3.25rem; border-radius: 50%; flex: none; }
    @keyframes hs-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
    @media (prefers-reduced-motion: reduce) { .sk { animation: none; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Skeleton {
  readonly kind = input<SkeletonKind>('table');
  readonly label = input('Loading');
  readonly lines = input(5);

  protected readonly two = [0, 1];
  protected readonly three = [0, 1, 2];
  protected readonly rows = computed(() => Array.from({ length: this.lines() }, (_, i) => i));
}
