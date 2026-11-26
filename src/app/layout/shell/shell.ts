import { ChangeDetectionStrategy, Component, computed, inject, DestroyRef, signal } from '@angular/core';
import { NotificationsBell } from './notifications-bell';
import { CompanySwitcher } from './company-switcher';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ActivatedRoute, NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterLink, RouterOutlet,
} from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, map } from 'rxjs';
import { ThemeService } from '../../core/theme/theme.service';
import { AuthService } from '../../core/auth/auth.service';
import { IconName } from '../../core/icons/icons';
import { Logo } from '../../shared/ui/logo';
import { AccessBanner } from '../../shared/ui/access-banner';
import { LiveChanges } from '../../core/live/live-changes';

interface NavItem {
  readonly label: string;
  readonly path: string;
  readonly icon: IconName;
}

/** 14 Nov 2026 (Bilal): from 1200px the full sidebar pushes the page and can be made slim (icons with tooltips);
    tablets (768–1199px) show the slim rail, and opening it lays the full sidebar over the page.
    15 Nov 2026 (Bilal): phones (under 768px) have no rail: a menu button in the top bar slides the sidebar in. */
const WIDE_SCREEN = '(min-width: 1200px)';
const SMALL_SCREEN = '(max-width: 767px)';
const SLIM_KEY = 'hs-sidebar-slim';

/** "Aisha Khan" → "AK", "Aisha" → "A" (first letter of the first and the last name). */
export function initials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function readSlim(): boolean {
  try { return localStorage.getItem(SLIM_KEY) === '1'; } catch { return false; } // a per-viewer convenience only
}

@Component({
  selector: 'hs-shell',
  imports: [
    RouterOutlet, RouterLink,
    MatSidenavModule, MatToolbarModule, MatListModule, MatIconModule, MatButtonModule, MatMenuModule, MatTooltipModule, Logo, NotificationsBell, AccessBanner, CompanySwitcher,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: { '(document:keydown.escape)': 'overlayOpen.set(false)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly isWide = toSignal(
    inject(BreakpointObserver).observe(WIDE_SCREEN).pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  protected readonly isSmall = toSignal(
    inject(BreakpointObserver).observe(SMALL_SCREEN).pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  /** Wide screens: the person's choice (remembered in this browser). */
  protected readonly slimChosen = signal(readSlim());
  /** Narrow screens: the full sidebar laid over the page. */
  protected readonly overlayOpen = signal(false);
  protected readonly slim = computed(() => {
    if (this.isSmall()) return false; // the phone menu is always the full sidebar
    return this.isWide() ? this.slimChosen() : !this.overlayOpen();
  });
  protected readonly initials = computed(() => initials(this.auth.user()?.name));

  protected readonly nav: readonly NavItem[] = [
    { label: 'Dashboard', path: 'dashboard', icon: 'dashboard' },
    { label: 'Products', path: 'products', icon: 'box' },
    { label: 'Suppliers', path: 'suppliers', icon: 'truck' },
    { label: 'Certificates', path: 'certificates', icon: 'file' },
    { label: 'Settings', path: 'settings', icon: 'settings' },
  ];

  /** The page being opened (from the moment of the click), so the green pill slides there straight away. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationStart || e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError),
      map((e) => (e instanceof NavigationStart ? e.url : this.router.url)),
    ),
    { initialValue: this.router.url },
  );
  protected readonly activeIndex = computed(() => {
    const path = this.url().split(/[?#]/)[0];
    return this.nav.findIndex((item) => path === `/${item.path}` || path.startsWith(`/${item.path}/`));
  });

  constructor() {
    // 5 Nov 2026: open screens refresh when the company's data changes (checked every 20 s while visible).
    const live = inject(LiveChanges);
    live.start();
    inject(DestroyRef).onDestroy(() => live.stop());
    // Arriving from the verification email link: /dashboard?verified=1
    if (inject(ActivatedRoute).snapshot.queryParamMap.get('verified') === '1') {
      inject(MatSnackBar).open('Your email is verified. Welcome to Global Halal Market!', 'Close', { duration: 6000 });
    }
  }

  protected toggleSidebar(): void {
    if (this.isWide()) {
      const next = !this.slimChosen();
      this.slimChosen.set(next);
      try { localStorage.setItem(SLIM_KEY, next ? '1' : '0'); } catch { /* private window: not remembered */ }
    } else {
      this.overlayOpen.update((open) => !open);
    }
  }

  /** A link in the laid-over sidebar closes it. */
  protected afterNavigate(): void {
    if (!this.isWide()) this.overlayOpen.set(false);
  }

  async logout(): Promise<void> {
    await this.auth.logout().catch(() => undefined);
    await this.router.navigateByUrl('/login');
  }
}
