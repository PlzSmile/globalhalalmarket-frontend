import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The Global Halal Market logo (same image as the public site header), linking to the public site.
 * In the dark theme it sits on a small white plate (--color-logo-backdrop) so the dark lettering stays readable.
 */
@Component({
  selector: 'hs-logo',
  template: `
    <a class="logo" href="/" aria-label="Global Halal Market home">
      <img src="/images/brand/logo-full-40.webp" srcset="/images/brand/logo-full-40.webp 1x, /images/brand/logo-full-80.webp 2x"
           width="211" height="32" alt="Global Halal Market" decoding="async" />
    </a>
  `,
  styles: `
    .logo { display: inline-flex; align-items: center; min-height: var(--touch-target); border-radius: var(--radius-sm); }
    .logo img { display: block; width: auto; height: 32px; padding: 4px 8px; margin-inline-start: -8px; border-radius: var(--radius-sm);
      background: var(--color-logo-backdrop); }
    @media (min-width: 1200px) { .logo img { height: 28px; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Logo {}
