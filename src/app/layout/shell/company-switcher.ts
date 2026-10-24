import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CompaniesApi } from '../../core/api/companies-api';
import { AuthService } from '../../core/auth/auth.service';
import { SwitchableCompanies } from '../../core/models/auth';
import { NameDialog, NameDialogData } from '../../shared/ui/name-dialog';

/**
 * Phase 7c: the company name in the top bar. For a consultant it opens a menu: their own company, their client
 * companies (up to 10) and "Add client company". Switching reloads the app so every list shows the chosen company.
 */
@Component({
  selector: 'hs-company-switcher',
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    @let user = auth.user();
    @if (user?.can_switch_companies) {
      <button mat-button type="button" class="switcher" [matMenuTriggerFor]="menu" (menuOpened)="load()" data-test="company-switcher"
              [attr.aria-label]="'Company: ' + user.company.name + '. Switch company'">
        @if (user.viewing_client) { <span class="switcher__client">Client</span> }
        <span class="switcher__name">{{ user.company.name }}</span>
        <mat-icon svgIcon="chevron-down" iconPositionEnd />
      </button>
      <mat-menu #menu="matMenu">
        @let list = companies();
        @if (!list) {
          <p class="switcher__hint">Loading…</p>
        } @else {
          @for (c of list.data; track c.id) {
            <button mat-menu-item type="button" (click)="switchTo(c.id)" [disabled]="c.current || busy()" [attr.data-test]="'switch-' + c.id">
              @if (c.current) { <mat-icon svgIcon="check" /> }
              {{ c.name }}{{ c.is_client ? '' : ' (your company)' }}
            </button>
          }
          @if (list.meta.can_manage) {
            <button mat-menu-item type="button" (click)="addClient()" [disabled]="busy()" data-test="add-client">
              <mat-icon svgIcon="plus" /> Add client company
            </button>
          }
        }
      </mat-menu>
    } @else {
      <span class="switcher__name switcher__name--plain">{{ user?.company?.name }}</span>
    }
  `,
  styles: `
    :host { margin-right: auto; min-width: 0; }
    .switcher { min-height: var(--touch-target); max-width: 100%; }
    .switcher__name { font-weight: var(--weight-semibold); font-size: var(--text-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .switcher__name--plain { display: inline-block; }
    .switcher__client { margin-right: var(--space-2); padding: 0 var(--space-2); border-radius: var(--radius-pill); background: var(--color-warning-bg); color: var(--color-warning-fg); font-size: var(--text-sm); font-weight: var(--weight-semibold); }
    .switcher__hint { margin: var(--space-3) var(--space-4); color: var(--color-text-muted); font-size: var(--text-sm); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanySwitcher {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(CompaniesApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly companies = signal<SwitchableCompanies | null>(null);
  protected readonly busy = signal(false);

  async load(): Promise<void> {
    try {
      this.companies.set(await firstValueFrom(this.api.list()));
    } catch {
      this.snackBar.open('Could not load your companies.', 'Close', { duration: 5000 });
    }
  }

  async switchTo(id: number): Promise<void> {
    this.busy.set(true);
    try {
      this.auth.setUser(await firstValueFrom(this.api.switchTo(id)));
      this.reload();
    } catch {
      this.busy.set(false);
      this.snackBar.open('Could not switch company. Please try again.', 'Close', { duration: 5000 });
    }
  }

  addClient(): void {
    const data: NameDialogData = {
      title: 'Add client company', label: 'Client company name', value: '', maxLength: 120,
      save: (name: string) => this.api.addClient(name),
    };
    this.dialog.open(NameDialog, { data, maxWidth: '32rem' }).afterClosed().subscribe((saved: unknown) => {
      if (saved) {
        void this.load();
        this.snackBar.open('Client company added. Pick it in the company menu to work on it.', 'Close', { duration: 5000 });
      }
    });
  }

  /** A full reload: lists, counts and caches all belong to the company just chosen. */
  protected reload(): void {
    window.location.assign('/app/dashboard');
  }
}
