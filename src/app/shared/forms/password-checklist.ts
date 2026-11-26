import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PASSWORD_MIN } from './validators';
import { passwordChecks } from './password-strength';

/**
 * 18 Nov 2026 (Bilal): live checklist under a new-password field (sign-up, reset, invitation, change password).
 * Only the length is required (same rule as the server); the mix of characters is a tip that raises the bar.
 */
@Component({
  selector: 'hs-password-checklist',
  imports: [MatIconModule],
  template: `
    <div class="pc" data-test="password-checklist">
      <div class="pc__bar" [attr.data-strength]="checks().strength" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
      <p class="pc__label" aria-live="polite">Strength: <b>{{ label() }}</b></p>
      <ul class="pc__list">
        <li [class.ok]="checks().longEnough" data-test="pc-length">
          <mat-icon [svgIcon]="checks().longEnough ? 'check' : 'circle'" />
          At least {{ min }} characters ({{ checks().length }}/{{ min }})
        </li>
        <li [class.ok]="checks().hasUpper"><mat-icon [svgIcon]="checks().hasUpper ? 'check' : 'circle'" />A capital letter</li>
        <li [class.ok]="checks().hasLower"><mat-icon [svgIcon]="checks().hasLower ? 'check' : 'circle'" />A small letter</li>
        <li [class.ok]="checks().hasNumberOrSymbol"><mat-icon [svgIcon]="checks().hasNumberOrSymbol ? 'check' : 'circle'" />A number or symbol</li>
        @if (confirmation()) {
          <li [class.ok]="matches()" data-test="pc-match"><mat-icon [svgIcon]="matches() ? 'check' : 'circle'" />Both passwords match</li>
        }
      </ul>
      <p class="pc__note">Only the length is required; the rest makes it stronger. We also refuse passwords found in known data leaks.</p>
    </div>
  `,
  styles: `
    .pc { margin: calc(var(--space-2) * -1) 0 var(--space-3); font-size: var(--text-sm); color: var(--color-text-muted); }
    .pc__bar { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-1); }
    .pc__bar span { height: 6px; border-radius: var(--radius-pill); background: var(--color-border); }
    .pc__bar[data-strength='short'] span:nth-child(1) { background: var(--color-danger-fg); }
    .pc__bar[data-strength='fair'] span:nth-child(-n + 1) { background: var(--color-warning-fg); }
    .pc__bar[data-strength='good'] span:nth-child(-n + 2) { background: var(--color-primary); }
    .pc__bar[data-strength='strong'] span { background: var(--color-success-fg); }
    .pc__label { margin: var(--space-1) 0; }
    .pc__list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-1); }
    .pc__list li { display: flex; align-items: center; gap: var(--space-2); }
    .pc__list li.ok { color: var(--color-success-fg); }
    .pc__list mat-icon { flex: none; width: 18px; height: 18px; }
    .pc__note { margin: var(--space-2) 0 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordChecklist {
  readonly password = input<string | null>('');
  readonly confirmation = input<string | null>('');

  private readonly value = computed(() => this.password() ?? '');

  protected readonly min = PASSWORD_MIN;
  protected readonly checks = computed(() => passwordChecks(this.value()));
  protected readonly matches = computed(() => this.value() !== '' && this.value() === this.confirmation());
  protected readonly label = computed(() => {
    const labels = { empty: 'not set', short: 'too short', fair: 'fair', good: 'good', strong: 'strong' } as const;
    return labels[this.checks().strength];
  });
}
