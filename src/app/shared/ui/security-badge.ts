import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * 5 Nov 2026 (Bilal): one line that tells users how their data is protected, linking to the public /security page.
 * Same facts as the Blade <x-security-badge> (docs/Security.md). Never "end-to-end encrypted": the service has to
 * read certificates to check them.
 */
@Component({
  selector: 'hs-security-badge',
  imports: [MatIconModule],
  template: `
    <p class="badge">
      <mat-icon svgIcon="shield" />
      <span>Encrypted in transit and at rest (AES-256) · Data stored in the UK ·
        <a href="/security" target="_blank" rel="noopener">How we protect your data<span class="visually-hidden"> (opens in a new tab)</span></a></span>
    </p>
  `,
  styles: `
    .badge { display: flex; align-items: flex-start; gap: var(--space-2); margin: 0; font-size: var(--text-sm); color: var(--color-text-muted); }
    mat-icon { flex: none; width: 18px; height: 18px; color: var(--color-primary); margin-top: 2px; }
    a { color: inherit; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityBadge {}
