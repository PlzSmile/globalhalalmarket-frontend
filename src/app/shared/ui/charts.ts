import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Small hand-made charts for the dashboard (14 Nov 2026, Bilal: "graphs like Foods Connected"), no chart package.
 * The line and area are SVG stretched to the box (strokes keep their width); labels, the last point and its value are
 * HTML so text stays readable (14px+) on phones. Colours come from tokens through `tone`.
 */
export type ChartTone = 'primary' | 'green' | 'amber' | 'red';

interface Point { readonly x: number; readonly y: number }

/** Points in a 0–100 box (y down), scaled between min and max; a flat series sits at `flatY`. */
export function toPoints(values: readonly number[], min: number, max: number, flatY = 80): Point[] {
  const n = values.length;
  return values.map((v, i) => ({
    x: n === 1 ? 50 : (i / (n - 1)) * 100,
    y: max === min ? flatY : 100 - ((v - min) / (max - min)) * 100,
  }));
}

/** A smooth line through the points (Catmull-Rom as cubic Béziers), control points kept inside the box. */
export function smoothPath(points: readonly Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M0 ${points[0].y} L100 ${points[0].y}`;
  const clamp = (y: number): number => Math.min(100, Math.max(0, y));
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: clamp(p1.y + (p2.y - p0.y) / 6) };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: clamp(p2.y - (p3.y - p1.y) / 6) };
    d += ` C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
  }
  return d;
}

/** A round axis top above the largest value: 4 steps of 1, 2, 5, 10, 20, 50… */
export function niceMax(max: number): number {
  if (max <= 4) return 4;
  const raw = max / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power;
  return step * 4;
}

/** "15 Jul" from an ISO date. */
export function shortDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

@Component({
  selector: 'hs-sparkline',
  template: `
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path class="area" [attr.d]="area()" />
      <path class="line" [attr.d]="line()" vector-effect="non-scaling-stroke" />
    </svg>
  `,
  styles: `
    :host { display: block; width: 100%; height: 100%; color: var(--chart-color); }
    :host(.tone--primary) { --chart-color: var(--color-primary); } :host(.tone--green) { --chart-color: var(--color-success-fg); }
    :host(.tone--amber) { --chart-color: var(--color-warning-fg); } :host(.tone--red) { --chart-color: var(--color-danger-fg); }
    svg { display: block; width: 100%; height: 100%; overflow: visible; }
    .line { fill: none; stroke: currentColor; stroke-width: 2.25; stroke-linecap: round; stroke-linejoin: round; }
    .area { fill: currentColor; opacity: 0.12; }
  `,
  host: { '[class]': '"tone--" + tone()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sparkline {
  readonly values = input.required<readonly number[]>();
  readonly tone = input<ChartTone>('primary');

  private readonly points = computed(() => {
    const v = this.values();
    return v.length ? toPoints(v, 0, Math.max(...v)) : []; // from zero, so 3 → 4 does not look like a cliff
  });
  protected readonly line = computed(() => smoothPath(this.points()));
  protected readonly area = computed(() => (this.points().length ? `${this.line()} L100 100 L0 100 Z` : ''));
}

@Component({
  selector: 'hs-area-chart',
  template: `
    <div class="chart" role="img" [attr.aria-label]="label()">
      <div class="chart__y" aria-hidden="true">
        @for (t of ticks(); track t) { <span>{{ t }}</span> }
      </div>
      <div class="chart__plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          @for (t of ticks(); track t; let i = $index) {
            <line class="grid" x1="0" x2="100" [attr.y1]="i * 100 / (ticks().length - 1)" [attr.y2]="i * 100 / (ticks().length - 1)" vector-effect="non-scaling-stroke" />
          }
          <path class="area" [attr.d]="area()" />
          <path class="line" [attr.d]="line()" vector-effect="non-scaling-stroke" />
        </svg>
        @if (last(); as p) {
          <span class="chart__dot" [style.left.%]="p.x" [style.top.%]="p.y" aria-hidden="true"></span>
          <strong class="chart__value" [style.top.%]="p.y" aria-hidden="true">{{ p.value }}</strong>
        }
      </div>
      <div class="chart__x" aria-hidden="true">
        @for (l of xLabels(); track $index) { <span>{{ l }}</span> }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; color: var(--chart-color); }
    :host(.tone--primary) { --chart-color: var(--color-primary); } :host(.tone--green) { --chart-color: var(--color-success-fg); }
    :host(.tone--amber) { --chart-color: var(--color-warning-fg); } :host(.tone--red) { --chart-color: var(--color-danger-fg); }
    .chart { display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: minmax(160px, 1fr) auto; column-gap: var(--space-3); row-gap: var(--space-2); height: 100%; }
    .chart__y { display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; margin-block: -0.6em; font-size: var(--text-sm); color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
    .chart__plot { position: relative; margin-right: 2.25rem; }
    svg { display: block; width: 100%; height: 100%; overflow: visible; }
    .grid { stroke: var(--color-border); stroke-width: 1; }
    .line { fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .area { fill: currentColor; opacity: 0.12; }
    .chart__dot { position: absolute; width: 10px; height: 10px; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 3px var(--color-surface); translate: -50% -50%; }
    .chart__value { position: absolute; left: calc(100% + var(--space-2)); translate: 0 -50%; font-size: var(--text-base); font-weight: var(--weight-bold); color: var(--color-text); }
    .chart__x { grid-column: 2; display: flex; justify-content: space-between; margin-right: 2.25rem; font-size: var(--text-sm); color: var(--color-text-muted); }
  `,
  host: { '[class]': '"tone--" + tone()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AreaChart {
  readonly values = input.required<readonly number[]>();
  /** ISO dates, one per value. */
  readonly dates = input.required<readonly string[]>();
  readonly label = input.required<string>();
  readonly tone = input<ChartTone>('primary');

  private readonly top = computed(() => niceMax(Math.max(0, ...this.values())));
  protected readonly ticks = computed(() => [4, 3, 2, 1, 0].map((i) => (this.top() / 4) * i));
  private readonly points = computed(() => toPoints(this.values(), 0, this.top(), 100));
  protected readonly line = computed(() => smoothPath(this.points()));
  protected readonly area = computed(() => (this.points().length ? `${this.line()} L100 100 L0 100 Z` : ''));
  protected readonly last = computed(() => {
    const p = this.points().at(-1);
    return p ? { ...p, value: this.values().at(-1) ?? 0 } : null;
  });
  protected readonly xLabels = computed(() => {
    const d = this.dates();
    return d.length ? [d[0], d[Math.floor((d.length - 1) / 2)], d[d.length - 1]].map(shortDay) : [];
  });
}
