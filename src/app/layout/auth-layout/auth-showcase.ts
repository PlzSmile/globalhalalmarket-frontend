import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { HighlightsApi } from '../../core/api/highlights-api';

type Point = readonly [number, number];

interface Market {
  readonly code: string;
  readonly authority: string;
  readonly country: string;
  readonly hub: Point;
  readonly around: readonly Point[];
  /** Where the floating card sits relative to the hub. */
  readonly card: 'below' | 'above';
}

/** The network drawing uses a 600 × 380 box; the HTML cards are placed in percent of the same box. */
const W = 600;
const H = 380;
const CENTER: Point = [300, 190];

const MARKETS: readonly Market[] = [
  { code: 'ID', authority: 'BPJPH', country: 'Indonesia', hub: [118, 92], card: 'below',
    around: [[62, 52], [168, 40], [52, 138], [196, 108], [150, 160]] },
  { code: 'MY', authority: 'JAKIM', country: 'Malaysia', hub: [482, 92], card: 'below',
    around: [[432, 40], [540, 54], [404, 108], [552, 140], [450, 160]] },
  { code: 'AE', authority: 'MoIAT', country: 'UAE', hub: [300, 312], card: 'above',
    around: [[228, 342], [376, 346], [236, 272], [366, 270], [300, 364]] },
];

/** Quiet background dots, like stars around the clusters. */
const DOTS: readonly Point[] = [
  [24, 28], [252, 26], [352, 22], [580, 24], [212, 214], [392, 226], [26, 250], [92, 304],
  [134, 356], [470, 352], [522, 300], [576, 236], [578, 350], [300, 120], [254, 160], [350, 156],
];

/** A soft curve from a to b (quadratic, bent sideways by `bend` of its length). */
function curve([ax, ay]: Point, [bx, by]: Point, bend = 0.18): string {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const cx = mx - (by - ay) * bend;
  const cy = my + (bx - ax) * bend;
  return `M${ax} ${ay} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${bx} ${by}`;
}

/** Lines inside each cluster (hub to every point, plus a few point to point) and the three links to our hub. */
const CLUSTER_LINES: readonly string[] = MARKETS.flatMap((m) => [
  ...m.around.map((p, i) => curve(m.hub, p, i % 2 ? 0.16 : -0.16)),
  curve(m.around[0], m.around[1], 0.12),
  curve(m.around[2], m.around[4], -0.12),
]);
const LINKS: readonly string[] = MARKETS.map((m, i) => curve(m.hub, CENTER, i === 2 ? 0.1 : 0.14));

const pct = ([x, y]: Point) => ({ left: (x / W) * 100, top: (y / H) * 100 });

/**
 * Side panel of the login and sign-up screens (Bilal, 12 Nov 2026: light and airy, a network of certifiers
 * around the three markets with small floating cards, not a big green block). Public data only.
 * `compact` = the short strip under the form on phones and tablets.
 */
@Component({
  selector: 'hs-auth-showcase',
  imports: [DatePipe, MatIconModule],
  template: `
    @let data = highlights();
    @if (!compact()) {
      <p class="eyebrow"><mat-icon svgIcon="globe" /> Checked every day</p>
      <h2 class="title">Verified Halal Certifier.</h2>
      <p class="lead">Every official halal list we follow in one place, with reminders before a certificate or a recognition runs out.</p>

      <div class="net" role="img" [attr.aria-label]="mapLabel()">
        <svg class="net__svg" [attr.viewBox]="'0 0 ' + w + ' ' + h" aria-hidden="true">
          @for (d of clusterLines; track $index) { <path class="net__line" [attr.d]="d" /> }
          @for (d of links; track $index) { <path class="net__link" [attr.d]="d" /> }
          @for (p of dots; track $index) { <circle class="net__dot" [attr.cx]="p[0]" [attr.cy]="p[1]" r="2.4" /> }
          @for (m of markets; track m.code) {
            @for (p of m.around; track $index) {
              <circle class="net__node" [class.net__node--soft]="$index % 2 === 1" [attr.cx]="p[0]" [attr.cy]="p[1]" r="6" />
              <circle class="net__core" [attr.cx]="p[0]" [attr.cy]="p[1]" r="2" />
            }
            <circle class="net__halo" [attr.cx]="m.hub[0]" [attr.cy]="m.hub[1]" r="15" />
            <circle class="net__node" [attr.cx]="m.hub[0]" [attr.cy]="m.hub[1]" r="9" />
            <circle class="net__core" [attr.cx]="m.hub[0]" [attr.cy]="m.hub[1]" r="3" />
          }
          <circle class="net__halo net__halo--pulse" [attr.cx]="center[0]" [attr.cy]="center[1]" r="20" />
          <circle class="net__hub" [attr.cx]="center[0]" [attr.cy]="center[1]" r="11" />
        </svg>

        @for (m of markets; track m.code) {
          <div class="card" [class.card--above]="m.card === 'above'" [style.left.%]="pos(m.hub).left" [style.top.%]="pos(m.hub).top" aria-hidden="true">
            <span class="card__row"><strong>{{ m.authority }}</strong>
              @if (count(m.authority); as n) { <span class="card__num">{{ n }}</span> }
            </span>
            <span class="card__meta">{{ m.country }} · {{ count(m.authority) !== null ? 'recognised bodies' : 'official list' }}</span>
          </div>
        }
      </div>

      @if (data?.changes?.length) {
        <section class="changes" aria-labelledby="latest-title">
          <h3 id="latest-title" class="changes__title">Latest from the official lists</h3>
          <ul>
            @for (change of data!.changes.slice(0, 2); track change.url + change.date) {
              <li class="change">
                <span class="change__tag" [class]="'change__tag change__tag--' + change.tone">{{ change.label }}</span>
                <a class="change__body" [href]="change.url" target="_blank" rel="noopener">{{ change.body }}</a>
                <span class="change__meta">{{ change.market }} · {{ change.date | date: 'd MMM y' }}</span>
              </li>
            }
          </ul>
        </section>
      }
    } @else {
      <ul class="strip" aria-label="Recognised certification bodies per market">
        @for (m of markets; track m.code) {
          <li><strong>{{ count(m.authority) ?? '·' }}</strong><span>{{ m.authority }} · {{ m.country }}</span></li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; color: var(--color-text); }
    mat-icon { width: 16px; height: 16px; }
    .eyebrow { display: inline-flex; align-items: center; gap: var(--space-2); margin: 0 0 var(--space-3); padding: var(--space-1) var(--space-3);
      border-radius: var(--radius-pill); background: var(--color-primary-soft); color: var(--color-primary);
      font-size: var(--text-sm); font-weight: var(--weight-semibold); }
    .title { margin: 0 0 var(--space-2); font-size: var(--text-2xl); line-height: 1.25; letter-spacing: var(--tracking-tight); max-width: 24ch; }
    .lead { margin: 0; font-size: var(--text-base); line-height: 1.55; color: var(--color-text-muted); max-width: 46ch; }

    /* The network: same aspect ratio as the SVG box, so the percent-placed cards line up with the hubs. */
    .net { position: relative; aspect-ratio: 600 / 380; margin: var(--space-5) 0 var(--space-4); }
    .net__svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .net__line { fill: none; stroke: var(--color-primary); stroke-width: 1.2; opacity: 0.28; }
    .net__link { fill: none; stroke: var(--color-primary); stroke-width: 1.4; stroke-dasharray: 5 5; opacity: 0.55; animation: flow 3s linear infinite; }
    .net__dot { fill: var(--color-border-strong); }
    .net__node { fill: var(--color-primary); }
    .net__node--soft { fill: color-mix(in srgb, var(--color-primary) 45%, var(--color-surface)); }
    .net__core { fill: var(--color-surface); }
    .net__halo { fill: none; stroke: var(--color-primary); stroke-width: 1.5; opacity: 0.35; }
    .net__halo--pulse { transform-box: fill-box; transform-origin: center; animation: pulse 2.6s ease-out infinite; }
    .net__hub { fill: var(--gold-500); stroke: var(--color-surface); stroke-width: 4; }

    .card { position: absolute; translate: -50% 18px; display: grid; gap: 2px; min-width: 9.5rem; padding: var(--space-2) var(--space-3);
      background: var(--color-surface-raised); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-lg);
      white-space: nowrap; }
    .card--above { translate: -50% calc(-100% - 18px); }
    .card__row { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-4); font-size: var(--text-base); }
    .card__num { font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--color-primary); line-height: 1; }
    .card__meta { font-size: var(--text-sm); color: var(--color-text-muted); }

    .changes__title { margin: 0 0 var(--space-2); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--color-text-muted); }
    .changes ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
    .change { display: grid; align-content: start; justify-items: start; gap: var(--space-1); padding: var(--space-3);
      background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
    .change__body { color: var(--color-text); font-weight: var(--weight-semibold); text-decoration: none; font-size: var(--text-sm); line-height: 1.35; }
    .change__body:hover { text-decoration: underline; }
    .change__meta { font-size: var(--text-sm); color: var(--color-text-muted); }
    .change__tag { padding: 1px var(--space-2); border-radius: var(--radius-pill); font-size: var(--text-xs); font-weight: var(--weight-semibold);
      background: var(--color-neutral-bg); color: var(--color-neutral-fg); }
    .change__tag--success { background: var(--color-success-bg); color: var(--color-success-fg); }
    .change__tag--warning { background: var(--color-warning-bg); color: var(--color-warning-fg); }
    .change__tag--danger { background: var(--color-danger-bg); color: var(--color-danger-fg); }
    .change__tag--info { background: var(--color-info-bg); color: var(--color-info-fg); }

    .strip { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); }
    .strip li { display: grid; gap: 2px; padding: var(--space-2) var(--space-1); border-radius: var(--radius-md); text-align: center;
      background: var(--color-surface); border: 1px solid var(--color-border); }
    .strip strong { font-size: var(--text-xl); color: var(--color-primary); }
    .strip span { font-size: var(--text-sm); color: var(--color-text-muted); }

    @keyframes flow { to { stroke-dashoffset: -20; } }
    @keyframes pulse { from { scale: 0.7; opacity: 0.6; } to { scale: 1.8; opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .net__link, .net__halo--pulse { animation: none; } }
    /* Short laptop screens: keep the panel on one screen without scrolling. */
    @media (max-height: 800px) { .lead { display: none; } .net { margin: var(--space-3) 0; } }
    /* Large screens run the compact desktop scale; the panel copy follows it. */
    @media (min-width: 1200px) { .title { font-size: var(--text-xl); } .lead { font-size: var(--text-sm); } .card__num { font-size: var(--text-lg); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthShowcase {
  readonly compact = input(false);
  protected readonly w = W;
  protected readonly h = H;
  protected readonly center = CENTER;
  protected readonly markets = MARKETS;
  protected readonly dots = DOTS;
  protected readonly clusterLines = CLUSTER_LINES;
  protected readonly links = LINKS;
  protected readonly pos = pct;
  protected readonly highlights = toSignal(inject(HighlightsApi).get(), { initialValue: null });

  private readonly counts = computed(() => new Map((this.highlights()?.markets ?? []).map((m) => [m.name.toLowerCase(), m.recognised])));

  protected count(authority: string): number | null {
    return this.counts().get(authority.toLowerCase()) ?? null;
  }

  protected readonly mapLabel = computed(() =>
    'Markets we check: ' + MARKETS.map((m) => `${m.country} (${m.authority})` + (this.count(m.authority) !== null ? `, ${this.count(m.authority)} recognised bodies` : '')).join('; '));
}
