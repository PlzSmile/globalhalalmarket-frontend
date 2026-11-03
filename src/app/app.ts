import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { Loader } from './shared/ui/loader';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Loader],
  template: `
    @if (navigating()) { <hs-loader class="route-loader" label="Opening the page" /> }
    <router-outlet />
  `,
  styles: `
    /* While a page's code loads (slow connections), the three dots show at the top centre. */
    .route-loader { position: fixed; top: var(--space-2); left: 50%; transform: translateX(-50%); z-index: 1100; padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-pill); background: var(--color-surface); box-shadow: var(--shadow-md); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly navigating = signal(false);

  constructor() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationStart) {
        clearTimeout(timer);
        timer = setTimeout(() => this.navigating.set(true), 200); // only when it is not instant
      } else if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) {
        clearTimeout(timer);
        this.navigating.set(false);
      }
    });
  }
}
