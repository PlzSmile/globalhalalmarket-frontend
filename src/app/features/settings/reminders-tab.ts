import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { MeApi } from '../../core/api/me-api';
import { AuthService } from '../../core/auth/auth.service';
import { CompanyReminders } from '../../core/models/auth';
import { actionError } from '../../shared/forms/error-message';

type Setting = keyof CompanyReminders;

/** Phase 6b: which reminders the company gets (owners and admins change them). */
@Component({
  selector: 'hs-reminders-tab',
  imports: [MatCardModule, MatSlideToggleModule],
  template: `
    <mat-card appearance="outlined" class="settings-card">
      <mat-card-header><mat-card-title>Reminders</mat-card-title></mat-card-header>
      <mat-card-content>
        <p class="lead">We email owners and admins one summary in the morning when something expires in 60, 30 or 7 days. Everyone sees reminders under the bell.</p>
        @if (!auth.canManageTeam()) { <p class="note">Only owners and admins can change these.</p> }
        @if (settings(); as s) {
          <div class="toggles">
            @for (row of rows; track row.key) {
              <mat-slide-toggle [checked]="s[row.key]" [disabled]="!auth.canManageTeam() || busy()" (change)="change(row.key, $event.checked)" [attr.data-test]="'toggle-' + row.key">
                <span class="toggle__label">{{ row.label }}</span>
                <span class="toggle__hint">{{ row.hint }}</span>
              </mat-slide-toggle>
            }
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .lead, .note { color: var(--color-text-muted); margin: 0 0 var(--space-4); }
    .toggles { display: grid; gap: var(--space-4); }
    mat-slide-toggle { min-height: var(--touch-target); }
    .toggle__label { display: block; font-weight: var(--weight-medium); }
    .toggle__hint { display: block; font-size: var(--text-sm); color: var(--color-text-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemindersTab implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(MeApi);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly settings = signal<CompanyReminders | null>(null);
  protected readonly busy = signal(false);
  protected readonly rows: readonly { key: Setting; label: string; hint: string }[] = [
    { key: 'certificates', label: 'Supplier certificates expiring', hint: '60, 30 and 7 days before a certificate expires.' },
    { key: 'recognitions', label: 'Certification bodies losing recognition', hint: 'When a body you rely on is about to stop being recognised in one of your markets.' },
    { key: 'auto_chase_suppliers', label: 'Ask suppliers automatically', hint: '30 days before expiry, email the supplier a link to upload the renewed certificate. You can turn this off per supplier.' },
  ];

  async ngOnInit(): Promise<void> {
    try {
      this.settings.set((await firstValueFrom(this.api.company())).reminders ?? null);
    } catch {
      this.snackBar.open('Reminder settings could not be loaded. Please reload the page.', 'Close', { duration: 6000 });
    }
  }

  protected async change(key: Setting, value: boolean): Promise<void> {
    const previous = this.settings();
    this.busy.set(true);
    try {
      this.settings.set((await firstValueFrom(this.api.updateReminders({ [key]: value }))).reminders ?? previous);
      this.snackBar.open('Reminder settings saved.', 'Close', { duration: 4000 });
    } catch (error) {
      this.settings.set(previous ? { ...previous } : null); // put the switch back
      this.snackBar.open(actionError(error, 'The setting could not be saved. Please try again.'), 'Close', { duration: 6000 });
    } finally {
      this.busy.set(false);
    }
  }
}
