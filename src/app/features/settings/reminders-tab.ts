import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ActivityApi, ActivityEntry } from '../../core/api/activity-api';
import { MeApi } from '../../core/api/me-api';
import { AuthService } from '../../core/auth/auth.service';
import { CompanyReminders } from '../../core/models/auth';
import { actionError } from '../../shared/forms/error-message';
import { ukDate } from '../../shared/format/uk-date';

export const MAX_REMINDERS = 5;
export const MAX_DAYS = 180;
export const CHASE_OPTIONS = [7, 14, 21, 30, 45, 60, 90] as const;

/** "Expires in 30 days", "Expires tomorrow", "Expires today". */
export function reminderLabel(days: number): string {
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days`;
}

/**
 * Phase 6b, redesigned 14 Nov 2026 (Bilal: "set by the customer, like Xero invoice reminders"): the company chooses
 * when certificate expiry emails go out (up to five reminders, 0 to 180 days before), whether and when suppliers are
 * asked for the renewed certificate, and recognition emails. Owners and admins change them; one Save.
 */
@Component({
  selector: 'hs-reminders-tab',
  imports: [FormsModule, RouterLink, MatButtonModule, MatCardModule, MatCheckboxModule, MatIconModule],
  template: `
    <div class="page">
      <mat-card appearance="outlined" class="hs-card">
        <mat-card-header class="head">
          <mat-card-title>Expiry reminders</mat-card-title>
          @if (draft(); as d) {
            <span class="status" [class.status--off]="!d.certificates" data-test="reminders-status">
              <span class="status__dot" aria-hidden="true"></span>Expiry reminders: {{ d.certificates ? 'On' : 'Off' }}
            </span>
          }
        </mat-card-header>
        <mat-card-content>
          @if (!auth.canManageTeam()) { <p class="note">Only owners and admins can change these.</p> }
          @if (draft(); as d) {
            <mat-checkbox [checked]="d.certificates" [disabled]="!canEdit()" (change)="set({ certificates: $event.checked })" data-test="toggle-certificates">
              <strong class="check__title">Email us when a supplier certificate…</strong>
            </mat-checkbox>

            <ol class="reminders" [class.reminders--off]="!d.certificates" aria-label="Certificate expiry reminders">
              @for (day of d.certificate_days; track $index; let i = $index) {
                <li class="reminder" [attr.data-test]="'reminder-' + i">
                  <mat-icon svgIcon="mail" class="reminder__icon" aria-hidden="true" />
                  @if (editing() === i) {
                    <label class="reminder__edit">
                      <span class="visually-hidden">Days before the certificate expires</span>
                      <input class="input reminder__input" type="number" inputmode="numeric" min="0" [max]="maxDays" [ngModel]="day"
                             (ngModelChange)="setDay(i, $event)" data-test="reminder-days" />
                      <span>days before</span>
                    </label>
                    <span class="reminder__actions">
                      <button mat-button type="button" (click)="editing.set(null)" data-test="reminder-done">Done</button>
                      <button mat-button type="button" class="danger" (click)="remove(i)" [disabled]="d.certificate_days.length === 1" data-test="reminder-remove">Remove</button>
                    </span>
                  } @else {
                    <span class="reminder__label">{{ label(day) }}</span>
                    <button mat-button type="button" class="reminder__link" (click)="editing.set(i)" [disabled]="!canEdit()"
                            [attr.aria-label]="'Edit the reminder: ' + label(day)">Edit</button>
                  }
                </li>
              }
              @if (d.certificate_days.length < maxReminders) {
                <li class="reminder reminder--add">
                  <button mat-button type="button" (click)="add()" [disabled]="!canEdit()" data-test="reminder-add"><mat-icon svgIcon="plus" /> Add reminder</button>
                </li>
              }
            </ol>
            @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }

            <div class="options">
              <div class="option">
                <mat-checkbox [checked]="d.auto_chase_suppliers" [disabled]="!canEdit()" (change)="set({ auto_chase_suppliers: $event.checked })" data-test="toggle-auto_chase_suppliers">
                  Ask the supplier for the renewed certificate
                </mat-checkbox>
                <label class="option__select">
                  <select class="input" [ngModel]="d.chase_days" (ngModelChange)="set({ chase_days: +$event })" [disabled]="!canEdit() || !d.auto_chase_suppliers" data-test="chase-days"
                          aria-label="When to ask the supplier">
                    @for (o of chaseOptions; track o) { <option [ngValue]="o">{{ o }} days before expiry</option> }
                  </select>
                </label>
              </div>
              <p class="hint">We email the supplier a link to upload it, once. You can turn this off for one supplier on its page.</p>
              <mat-checkbox [checked]="d.recognitions" [disabled]="!canEdit()" (change)="set({ recognitions: $event.checked })" data-test="toggle-recognitions">
                Email us when a certification body we rely on is about to lose recognition
              </mat-checkbox>
              <p class="hint">60, 30 and 7 days before the authority's end date. Everyone also sees reminders under the bell.</p>
            </div>
          }
        </mat-card-content>
        @if (draft()) {
          <mat-card-actions align="end">
            <button mat-flat-button type="button" (click)="save()" [disabled]="!canEdit() || !dirty() || !!error() || busy()" data-test="save">Save</button>
          </mat-card-actions>
        }
      </mat-card>

      @if (history().length) {
        <section class="history" aria-labelledby="reminders-history">
          <h3 id="reminders-history">History</h3>
          @for (h of history(); track h.id) {
            <p class="history__item">
              <strong>Edited</strong> — {{ summary(h) }}<br />
              <span class="muted">By {{ h.actor }}, {{ date(h.at) }}</span>
            </p>
          }
          <a routerLink="/settings" [queryParams]="{ tab: 'activity' }">Show all activity</a>
        </section>
      }
    </div>
  `,
  styles: `
    .page { display: grid; gap: var(--space-4); max-width: 1040px; }
    .head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); }
    .status { display: inline-flex; align-items: center; gap: var(--space-2); min-height: 40px; padding: 0 var(--space-4);
      border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); background: var(--color-surface);
      font-weight: var(--weight-semibold); color: var(--color-link); }
    .status__dot { width: 10px; height: 10px; border-radius: 50%; background: var(--color-success-fg); }
    .status--off { color: var(--color-text-muted); }
    .status--off .status__dot { background: var(--color-text-subtle); }
    .note { color: var(--color-text-muted); margin: 0 0 var(--space-4); }
    .check__title { font-weight: var(--weight-semibold); }

    .reminders { list-style: none; margin: var(--space-3) 0 0; padding: 0; display: grid; gap: var(--space-3);
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
    .reminders--off { opacity: 0.55; }
    .reminder { display: grid; justify-items: center; align-content: center; gap: var(--space-1); min-height: 118px; padding: var(--space-3);
      border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); background: var(--color-surface); text-align: center; }
    .reminder__icon { width: 22px; height: 22px; color: var(--color-text-muted); }
    .reminder__label { font-weight: var(--weight-medium); }
    .reminder__link { min-height: var(--touch-target); }
    .reminder__edit { display: inline-flex; align-items: center; gap: var(--space-2); }
    .reminder__input { width: 5.5rem; text-align: center; font-size: var(--text-base); }
    .reminder__actions { display: flex; gap: var(--space-2); }
    .reminder--add { border-style: dashed; background: transparent; }
    .reminder--add button { min-height: var(--touch-target); }
    .danger { color: var(--color-danger-fg); }
    .error { margin: var(--space-2) 0 0; color: var(--color-danger-fg); font-size: var(--text-sm); }

    .options { display: grid; gap: var(--space-1); margin-top: var(--space-5); padding-top: var(--space-4); border-top: 1px solid var(--color-border); }
    .option { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-4); }
    .option__select select { min-height: var(--touch-target); font-size: var(--text-base); }
    .hint { margin: 0 0 var(--space-3) var(--space-10); font-size: var(--text-sm); color: var(--color-text-muted); }
    mat-checkbox { min-height: var(--touch-target); }

    .history { display: grid; gap: var(--space-2); margin-top: var(--space-6); }
    .history h3 { margin: 0; padding-bottom: var(--space-2); border-bottom: 1px solid var(--color-border); font-size: var(--text-lg); }
    .history__item { margin: 0; }
    .history a { display: inline-flex; align-items: center; min-height: var(--touch-target); }
    @media (max-width: 599px) {
      .reminders { grid-template-columns: 1fr 1fr; }
      .hint { margin-left: 0; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemindersTab implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(MeApi);
  private readonly activity = inject(ActivityApi);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly maxReminders = MAX_REMINDERS;
  protected readonly maxDays = MAX_DAYS;
  protected readonly chaseOptions = CHASE_OPTIONS;
  protected readonly label = reminderLabel;
  protected readonly date = ukDate;

  /** What is saved, and what is on screen. */
  protected readonly saved = signal<CompanyReminders | null>(null);
  protected readonly draft = signal<CompanyReminders | null>(null);
  protected readonly editing = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly history = signal<readonly ActivityEntry[]>([]);

  protected readonly canEdit = computed(() => this.auth.canManageTeam() && !this.busy());
  protected readonly dirty = computed(() => JSON.stringify(this.draft()) !== JSON.stringify(this.saved()));
  protected readonly error = computed(() => {
    const days = this.draft()?.certificate_days ?? [];
    if (days.some((d) => !Number.isInteger(d) || d < 0 || d > MAX_DAYS)) return `Use a whole number of days from 0 to ${MAX_DAYS}.`;
    if (new Set(days).size !== days.length) return 'Two reminders are on the same day. Change or remove one.';
    return null;
  });

  async ngOnInit(): Promise<void> {
    try {
      this.load((await firstValueFrom(this.api.company())).reminders ?? null);
    } catch {
      this.snackBar.open('Reminder settings could not be loaded. Please reload the page.', 'Close', { duration: 6000 });
    }
    if (this.auth.canManageTeam()) void this.loadHistory();
  }

  protected set(change: Partial<CompanyReminders>): void {
    this.draft.update((d) => (d ? { ...d, ...change } : d));
  }

  protected setDay(index: number, value: number | string | null): void {
    const day = value === null || value === '' ? Number.NaN : Number(value);
    this.draft.update((d) => (d ? { ...d, certificate_days: d.certificate_days.map((x, i) => (i === index ? day : x)) } : d));
  }

  /** A new reminder on a free day (14, 1, 90… whichever is not used yet), opened for editing. */
  protected add(): void {
    const d = this.draft();
    if (!d || d.certificate_days.length >= MAX_REMINDERS) return;
    const day = [14, 1, 90, 45, 3, 0].find((x) => !d.certificate_days.includes(x)) ?? 0;
    this.set({ certificate_days: [...d.certificate_days, day] });
    this.editing.set(d.certificate_days.length);
  }

  protected remove(index: number): void {
    this.draft.update((d) => (d && d.certificate_days.length > 1 ? { ...d, certificate_days: d.certificate_days.filter((_, i) => i !== index) } : d));
    this.editing.set(null);
  }

  protected async save(): Promise<void> {
    const d = this.draft();
    if (!d || this.error()) return;
    this.busy.set(true);
    this.editing.set(null);
    try {
      this.load((await firstValueFrom(this.api.updateReminders(d))).reminders ?? d);
      this.snackBar.open('Reminder settings saved.', 'Close', { duration: 4000 });
      void this.loadHistory();
    } catch (error) {
      this.snackBar.open(actionError(error, 'The settings could not be saved. Please try again.'), 'Close', { duration: 6000 });
    } finally {
      this.busy.set(false);
    }
  }

  protected summary(entry: ActivityEntry): string {
    return entry.changes.map((c) => `${c.field}: ${c.to ?? 'none'}`).join('; ') || entry.description;
  }

  /** Saved settings, reminders soonest last (60, 30, 7 like a timeline). */
  private load(r: CompanyReminders | null): void {
    const sorted = r ? { ...r, certificate_days: [...r.certificate_days].sort((a, b) => b - a) } : null;
    this.saved.set(sorted);
    this.draft.set(sorted);
  }

  private async loadHistory(): Promise<void> {
    try {
      const page = await firstValueFrom(this.activity.page(null, 'reminders_changed'));
      this.history.set(page.data.slice(0, 3));
    } catch {
      this.history.set([]); // the history is extra; the settings still work
    }
  }
}
