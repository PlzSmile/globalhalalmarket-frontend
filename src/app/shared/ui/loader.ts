import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The app's loader (Bilal, 3 Nov 2026): three dots that take turns, in the brand colour. Used while an action runs
 * (logging in, saving, importing). Whole screens that load show a skeleton (hs-skeleton) instead.
 * Screen readers hear the label once (role="status"); with reduced motion the dots stand still.
 */
@Component({
  selector: 'hs-loader',
  template: `<span class="loader" aria-hidden="true"></span><span class="visually-hidden">{{ label() }}</span>`,
  host: { role: 'status', '[class.hs-loader--inline]': 'inline()' },
  styles: `
    :host { display: flex; justify-content: center; padding: var(--space-3) 0; color: var(--color-primary); }
    :host(.hs-loader--inline) { display: inline-flex; padding: 0; vertical-align: middle; }
    .loader {
      width: var(--loader-width, 48px);
      aspect-ratio: 4;
      --_g: no-repeat radial-gradient(circle closest-side, currentColor 90%, transparent);
      background: var(--_g) 0% 50%, var(--_g) 50% 50%, var(--_g) 100% 50%;
      background-size: calc(100% / 3) 100%;
      animation: hs-dots 1s infinite linear;
    }
    :host(.hs-loader--inline) .loader { --loader-width: 28px; }
    @keyframes hs-dots {
      33% { background-size: calc(100% / 3) 0%, calc(100% / 3) 100%, calc(100% / 3) 100%; }
      50% { background-size: calc(100% / 3) 100%, calc(100% / 3) 0%, calc(100% / 3) 100%; }
      66% { background-size: calc(100% / 3) 100%, calc(100% / 3) 100%, calc(100% / 3) 0%; }
    }
    @media (prefers-reduced-motion: reduce) { .loader { animation: none; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Loader {
  readonly label = input('Loading');
  /** Small, inside a button or a line of text. */
  readonly inline = input(false);
}
