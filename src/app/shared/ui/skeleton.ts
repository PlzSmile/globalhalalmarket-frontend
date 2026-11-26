import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SkeletonKind = 'dashboard' | 'table' | 'detail' | 'list';

/**
 * While a screen loads: white cards in the page's shape, each with three dots that pulse in the middle
 * (14 Nov 2026, Bilal: "like Xero", on every screen; replaced the grey shimmer bars of 3 Nov). One element tells
 * screen readers what is loading (role="status").
 */
@Component({
  selector: 'hs-skeleton',
  template: `
    <span class="visually-hidden">{{ label() }}</span>
    @switch (kind()) {
      @case ('dashboard') {
        <div class="ld-grid ld-grid--dashboard">
          <div class="ld-card ld-card--short"><ng-container [ngTemplateOutlet]="dots" /></div>
          <div class="ld-card ld-card--short"><ng-container [ngTemplateOutlet]="dots" /></div>
          <div class="ld-card ld-card--tall"><ng-container [ngTemplateOutlet]="dots" /></div>
          <div class="ld-card ld-card--tall"><ng-container [ngTemplateOutlet]="dots" /></div>
        </div>
      }
      @case ('detail') {
        <div class="ld-grid ld-grid--2">
          @for (i of two; track i) { <div class="ld-card" [style.min-height.px]="height()"><ng-container [ngTemplateOutlet]="dots" /></div> }
        </div>
      }
      @default {
        <div class="ld-card" [style.min-height.px]="height()"><ng-container [ngTemplateOutlet]="dots" /></div>
      }
    }
    <ng-template #dots><span class="ld-dots" aria-hidden="true"><span></span><span></span><span></span></span></ng-template>
  `,
  imports: [NgTemplateOutlet],
  host: { role: 'status', 'aria-live': 'polite' },
  styles: `
    :host { display: grid; gap: var(--space-4); }
    .ld-grid { display: grid; gap: var(--space-4); }
    @media (min-width: 1200px) { .ld-grid--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .ld-grid--dashboard { grid-template-columns: minmax(0, 1fr); }
    @media (min-width: 768px) {
      .ld-grid--dashboard { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(220px, auto)); }
      .ld-card--short:nth-child(1) { grid-column: 1; grid-row: 1; }
      .ld-card--short:nth-child(2) { grid-column: 1; grid-row: 2; }
      .ld-card--tall { grid-row: 1 / span 2; }
    }
    .ld-card {
      display: grid; place-items: center; min-height: 220px; border: 1px solid var(--color-border); border-radius: var(--radius-lg);
      background: var(--color-surface); box-shadow: var(--shadow-card);
    }
    @media (max-width: 767px) { .ld-card--tall { display: none; } .ld-card { min-height: 160px; } }
    .ld-dots { display: inline-flex; align-items: center; gap: 10px; }
    .ld-dots span { width: 9px; height: 9px; border-radius: 50%; background: var(--color-text); animation: ld-pulse 1.2s ease-in-out infinite; }
    .ld-dots span:nth-child(2) { animation-delay: 0.15s; }
    .ld-dots span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes ld-pulse { 0%, 80%, 100% { transform: scale(0.7); opacity: 0.45; } 40% { transform: scale(1.25); opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .ld-dots span { animation-duration: 2.4s; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Skeleton {
  readonly kind = input<SkeletonKind>('table');
  readonly label = input('Loading');
  /** Rows the page will show: makes the card about as tall as the content to come. */
  readonly lines = input(5);

  protected readonly two = [0, 1];
  protected readonly height = computed(() => Math.max(160, Math.min(520, this.lines() * 52 + 80)));
}
