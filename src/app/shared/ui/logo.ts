import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Global Halal Market mark + wordmark, linking to the public site. Used in the shell and the auth layout. */
@Component({
  selector: 'hs-logo',
  template: `
    <a class="logo" href="/" aria-label="Global Halal Market public site">
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M16 2.5 4.5 6.8v8.4c0 7.2 4.9 12.6 11.5 14.3 6.6-1.7 11.5-7.1 11.5-14.3V6.8L16 2.5z" fill="currentColor" opacity=".14"/>
        <path d="M16 2.5 4.5 6.8v8.4c0 7.2 4.9 12.6 11.5 14.3 6.6-1.7 11.5-7.1 11.5-14.3V6.8L16 2.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="m10.5 16 3.8 3.8 7.2-8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Global Halal <span class="logo__accent">Market</span></span>
    </a>
  `,
  styles: `
    .logo { display: inline-flex; align-items: center; gap: var(--space-2); color: var(--color-text); text-decoration: none;
      font-weight: var(--weight-bold); font-size: var(--text-lg); min-height: 44px; white-space: nowrap; }
    .logo svg { width: 28px; height: 28px; color: var(--color-primary); }
    .logo__accent { color: var(--color-primary); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Logo {}
