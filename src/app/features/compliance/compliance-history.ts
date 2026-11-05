import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { ComplianceApi } from '../../core/api/compliance-api';
import { Paginated } from '../../core/models/catalogue';
import { HistoryEntry, StatusOnDate } from '../../core/models/compliance';
import { errorMessage } from '../../shared/forms/error-message';
import { toIsoDate, ukDate, ukDateTime } from '../../shared/format/uk-date';
import { UkDateAdapter } from '../../shared/format/uk-date-adapter';
import { StatusBadge } from '../../shared/ui/status-badge';

import { Skeleton } from '../../shared/ui/skeleton';
import { MatCardModule } from '@angular/material/card';
import { marketLabel } from '../../core/models/markets';
type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; page: Paginated<HistoryEntry> };

/** Every status change of a product, and "what did we know on this date?" for audits. */
@Component({
  selector: 'hs-compliance-history',
  imports: [Skeleton, MatCardModule, ReactiveFormsModule, MatButtonModule, MatDatepickerModule, MatFormFieldModule, MatInputModule, MatPaginatorModule, StatusBadge],
  providers: [provideNativeDateAdapter(), { provide: DateAdapter, useClass: UkDateAdapter }, { provide: MAT_DATE_LOCALE, useValue: 'en-GB' }],
  template: `
    <!-- 3 Nov 2026: two cards side by side on large screens: the status on a chosen date, and every change. -->
    <mat-card appearance="outlined" class="hs-card">
      <mat-card-header><mat-card-title><h3 class="panel-title">Status on a date</h3></mat-card-title></mat-card-header>
      <mat-card-content class="panel">

        <form class="on-date" (submit)="$event.preventDefault(); showOn()">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Status on date</mat-label>
            <input matInput [matDatepicker]="picker" [formControl]="date" [max]="today" placeholder="DD/MM/YYYY" data-test="on-date" />
            <mat-datepicker-toggle matIconSuffix [for]="picker" />
            <mat-datepicker #picker />
          </mat-form-field>
          <button mat-stroked-button type="submit" class="btn" [disabled]="busy()">Show</button>
        </form>
        @if (dateError(); as message) { <p class="notice notice--error" role="alert">{{ message }}</p> }
        @if (onDate(); as o) {
          <section class="on-result" data-test="on-result" aria-live="polite">
            <h3 class="on-result__title">{{ day(o.on) }}</h3>
            <ul class="entries">
              @for (e of o.markets; track e.market) {
                <li class="entry">
                  <div class="entry__top"><span class="entry__market">{{ label(e.market) }}</span>@if (e.status; as status) { <hs-status-badge [status]="status" /> }</div>
                  @let rs = shown(e.reasons); @if (rs.length) { <ul class="reasons">@for (r of rs; track $index) { <li>{{ r }}</li> }</ul> }
                </li>
              }
            </ul>
          </section>
        }

      </mat-card-content>
    </mat-card>
    <mat-card appearance="outlined" class="hs-card">
      <mat-card-header><mat-card-title><h3 class="panel-title">All changes</h3></mat-card-title></mat-card-header>
      <mat-card-content class="panel">
    @let s = state();
        @if (s.kind === 'loading') {
          <hs-skeleton kind="list" label="Loading history" />
        } @else if (s.kind === 'error') {
          <p role="alert">We couldn't load the history.</p>
          <button mat-stroked-button type="button" class="btn" (click)="load()">Try again</button>
        } @else if (s.page.meta.total === 0) {
          <p class="muted">No changes recorded yet.</p>
        } @else {
          <ul class="entries entries--changes">
            @for (e of s.page.data; track $index) {
              <li class="entry">
                <div class="entry__top">
                  <span class="entry__market">{{ e.changed_at ? time(e.changed_at) : '' }} · {{ label(e.market) }}</span>
                  @if (e.status; as status) { <hs-status-badge [status]="status" /> } @else { <span class="muted">No longer checked here</span> }
                </div>
                @let rs = shown(e.reasons); @if (rs.length) { <ul class="reasons">@for (r of rs; track $index) { <li>{{ r }}</li> }</ul> }
              </li>
            }
          </ul>
          <mat-paginator [length]="s.page.meta.total" [pageSize]="25" [pageIndex]="page() - 1" [hidePageSize]="true" (page)="onPage($event)" aria-label="Choose history page" />
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    /* 5 Nov 2026 (Bilal): stacked, so the short date check never leaves a tall empty column next to the long list;
       on large screens the list itself uses two columns. */
    :host { display: grid; gap: var(--space-4); align-items: start; }
    @media (min-width: 1200px) { .entries--changes { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--space-6); } }
    .panel { display: grid; gap: var(--space-3); }
    .panel-title { font-size: var(--text-lg); margin: 0; }
    .on-date { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
    .btn { min-height: var(--touch-target); }
    .on-result { display: grid; gap: var(--space-2); padding: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
    .on-result__title { font-size: var(--text-base); margin: 0; }
    .entries { list-style: none; margin: 0; padding: 0; display: grid; }
    .entry { display: grid; gap: var(--space-1); padding-block: var(--space-2); border-top: 1px solid var(--color-border); }
    .entry__top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2); }
    .entry__market { font-weight: var(--weight-semibold); font-size: var(--text-sm); }
    .reasons { margin: 0; padding-inline-start: var(--space-5); font-size: var(--text-sm); color: var(--color-text-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComplianceHistory {
  protected readonly label = marketLabel;
  readonly productId = input.required<number>();
  /** Bumped by the product page after each recalculation; reloads the list. */
  readonly version = input(0);

  private readonly api = inject(ComplianceApi);

  protected readonly state = signal<State>({ kind: 'loading' });
  protected readonly page = signal(1);
  protected readonly onDate = signal<StatusOnDate | null>(null);
  protected readonly dateError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly date = new FormControl<Date | null>(null);
  protected readonly today = new Date();
  protected readonly day = ukDate;
  protected readonly time = ukDateTime;

  /** "scope not checked" lines are left out (Bilal, 3 Nov 2026), as in the breakdown. */
  protected shown(reasons: readonly string[]): readonly string[] {
    return reasons.filter((r) => !/scope not checked/i.test(r));
  }

  constructor() {
    effect(() => {
      this.version();
      this.productId();
      untracked(() => void this.load());
    });
  }

  private latestRequest = 0;

  async load(): Promise<void> {
    const request = ++this.latestRequest;
    try {
      const page = await firstValueFrom(this.api.history(this.productId(), this.page()));
      if (request === this.latestRequest) { // an older, slower answer never replaces a newer one
        this.state.set({ kind: 'ready', page });
      }
    } catch {
      if (request === this.latestRequest) {
        this.state.set({ kind: 'error' });
      }
    }
  }

  protected onPage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    void this.load();
  }

  protected async showOn(): Promise<void> {
    const value = this.date.value;
    this.dateError.set(null);
    if (!value) {
      this.dateError.set('Enter a date.');
      return;
    }
    this.busy.set(true);
    try {
      this.onDate.set(await firstValueFrom(this.api.statusOn(this.productId(), toIsoDate(value))));
    } catch (error) {
      this.onDate.set(null);
      this.dateError.set(errorMessage(error, 'Choose a date up to today.'));
    } finally {
      this.busy.set(false);
    }
  }
}
