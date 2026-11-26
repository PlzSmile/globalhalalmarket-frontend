import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService } from '../../core/theme/theme.service';
import { Logo } from '../../shared/ui/logo';
import { AuthShowcase } from './auth-showcase';

/**
 * Login, sign-up, password and invitation screens (redesigned 11 Nov 2026, refined 12 Nov, Bilal): the logo and the
 * form in a card on the left; on large screens a light panel on the right with the certifier network and the latest
 * official list changes. Phones and tablets get one column: the card, then a short strip with the live counts.
 */
@Component({
  selector: 'hs-auth-layout',
  imports: [RouterOutlet, MatButtonModule, MatIconModule, MatTooltipModule, Logo, AuthShowcase],
  template: `
    <main class="auth" id="app-main" tabindex="-1">
      <div class="auth__form-side">
        <div class="auth__top">
          <hs-logo />
          <button mat-icon-button type="button" (click)="theme.toggle()"
                  [matTooltip]="theme.theme() === 'dark' ? 'Light theme' : 'Dark theme'"
                  [attr.aria-pressed]="theme.theme() === 'dark'"
                  [attr.aria-label]="theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'">
            <mat-icon [svgIcon]="theme.theme() === 'dark' ? 'sun' : 'moon'" />
          </button>
        </div>
        <section class="auth__card"><router-outlet /></section>
        <hs-auth-showcase class="auth__strip" [compact]="true" />
      </div>
      <aside class="auth__panel" aria-label="About Global Halal Market">
        <hs-auth-showcase />
      </aside>
    </main>
  `,
  styles: `
    .auth { min-height: 100dvh; display: grid; grid-template-columns: minmax(0, 1fr); background: var(--color-bg); }
    .auth__form-side { --auth-width: 25rem; display: grid; align-content: start; justify-items: center; gap: var(--space-4);
      padding: var(--space-4) var(--gutter) var(--space-8); }
    .auth__top { width: min(100%, var(--auth-width)); display: flex; align-items: center; justify-content: space-between; }
    .auth__card { box-sizing: border-box; width: min(100%, var(--auth-width)); background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-lg); box-shadow: var(--shadow-md); padding: var(--space-5) var(--space-4); }
    .auth__strip { width: min(100%, var(--auth-width)); }
    .auth__panel { display: none; }

    @media (min-width: 768px) {
      .auth__form-side { align-content: center; padding-top: var(--space-6); }
      .auth__card { padding: var(--space-6) var(--space-8); }
    }
    /* Large screens: smaller form card left, full-height light network panel right (edge to edge, 12 Nov 2026). */
    @media (min-width: 1200px) {
      .auth { grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); }
      .auth__form-side { --auth-width: 22.5rem; gap: var(--space-3); }
      .auth__card { padding: var(--space-5) var(--space-6); }
      .auth__strip { display: none; }
      .auth__panel { position: sticky; top: 0; box-sizing: border-box; display: grid; align-content: center;
        height: 100dvh; padding: var(--space-6) var(--space-10); overflow: auto; border-left: 1px solid var(--color-border);
        background: radial-gradient(circle at 50% 45%, var(--color-glow), transparent 60%),
                    radial-gradient(var(--color-border) 1px, transparent 1.5px) 0 0 / 18px 18px,
                    var(--color-surface-muted); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayout {
  protected readonly theme = inject(ThemeService);
}
