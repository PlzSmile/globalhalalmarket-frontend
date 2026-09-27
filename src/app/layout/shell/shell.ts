import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { map } from 'rxjs';
import { ThemeService } from '../../core/theme/theme.service';
import { IconName } from '../../core/icons/icons';

interface NavItem {
  readonly label: string;
  readonly path: string;
  readonly icon: IconName;
}

/** Large screens (>= 1200px): sidebar always visible. Small/medium: sidebar slides over the content. */
const LARGE_SCREEN = '(min-width: 1200px)';

@Component({
  selector: 'hs-shell',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatSidenavModule, MatToolbarModule, MatListModule, MatIconModule, MatButtonModule, MatTooltipModule,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly theme = inject(ThemeService);

  protected readonly isLarge = toSignal(
    inject(BreakpointObserver).observe(LARGE_SCREEN).pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly nav: readonly NavItem[] = [
    { label: 'Dashboard', path: 'dashboard', icon: 'dashboard' },
    { label: 'Products', path: 'products', icon: 'box' },
    { label: 'Suppliers', path: 'suppliers', icon: 'truck' },
    { label: 'Certificates', path: 'certificates', icon: 'file' },
    { label: 'Settings', path: 'settings', icon: 'settings' },
  ];
}
