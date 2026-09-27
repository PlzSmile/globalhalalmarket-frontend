import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

/** Must match the key used by the public site (public/js/app.js) so the choice is shared. */
export const THEME_STORAGE_KEY = 'hs-theme';

/**
 * Light/dark theme state. Follows the OS setting until the user picks a theme explicitly.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  // matchMedia is missing in some non-browser environments (tests, old embedded browsers).
  private readonly media =
    typeof this.document.defaultView?.matchMedia === 'function'
      ? this.document.defaultView.matchMedia('(prefers-color-scheme: dark)')
      : null;

  readonly theme = signal<Theme>(this.initialTheme());

  constructor() {
    effect(() => this.document.documentElement.setAttribute('data-theme', this.theme()));

    this.media?.addEventListener('change', (event) => {
      if (this.readStored() === null) {
        this.theme.set(event.matches ? 'dark' : 'light');
      }
    });
  }

  toggle(): void {
    const next: Theme = this.theme() === 'dark' ? 'light' : 'dark';
    this.store(next);
    this.theme.set(next);
  }

  private initialTheme(): Theme {
    return this.readStored() ?? (this.media?.matches ? 'dark' : 'light');
  }

  private readStored(): Theme | null {
    try {
      const value = this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      // Storage can be blocked (private mode, strict settings): fall back to the OS preference.
      return null;
    }
  }

  private store(theme: Theme): void {
    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage blocked: the theme still applies for this session, it just won't be remembered.
    }
  }
}
