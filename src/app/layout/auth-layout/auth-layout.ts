import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService } from '../../core/theme/theme.service';
import { Logo } from '../../shared/ui/logo';

/** Centred card for login, sign-up, password and invitation screens. */
@Component({
  selector: 'hs-auth-layout',
  imports: [RouterOutlet, MatButtonModule, MatIconModule, MatTooltipModule, Logo],
  template: `
    <main class="auth" id="app-main" tabindex="-1">
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
    </main>
  `,
  styles: `
    .auth { min-height: 100dvh; display: grid; align-content: start; justify-items: center; gap: var(--space-6);
      padding: var(--space-6) var(--gutter) var(--space-12); background: var(--color-bg); }
    .auth__top { width: min(100%, var(--container-form)); display: flex; align-items: center; justify-content: space-between; }
    .auth__card { width: min(100%, var(--container-form)); background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-lg); box-shadow: var(--shadow-md); padding: var(--space-8) var(--space-6); }
    @media (min-width: 768px) { .auth { align-content: center; } .auth__card { padding: var(--space-10); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayout {
  protected readonly theme = inject(ThemeService);
}
