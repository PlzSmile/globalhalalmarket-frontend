import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ComplianceApi } from '../../core/api/compliance-api';
import { Paginated } from '../../core/models/catalogue';
import { HistoryEntry, StatusOnDate } from '../../core/models/compliance';
import { errorMessage } from '../../shared/forms/error-message';
import { toIsoDate, ukDate, ukDateTime } from '../../shared/format/uk-date';
import { UkDateAdapter } from '../../shared/format/uk-date-adapter';
import { StatusBadge } from '../../shared/ui/status-badge';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; page: Paginated<HistoryEntry> };

/** Every status change of a product, and "what did we know on this date?" for audits. */
@Component({
  selector: 'hs-compliance-history',
  imports: [ReactiveFormsModule, MatButtonModule, MatDatepickerModule, MatFormFieldModule, MatInputModule, MatPaginatorModule, MatProgressBarModule, StatusBadge],
  providers: [provideNativeDateAdapter(), { provide: DateAdapter, useClass: UkDateAdapter }, { provide: MAT_DATE_LOCALE, useValue: 'en-GB' }],
  template: `
    <form class="on-date" (ngSubmit)="showOn()">
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
              <div class="entry__top"><span class="entry__market">{{ e.market }}</span>@if (e.status; as status) { <hs-status-badge [status]="status" /> }</div>
              @if (e.reasons.length) { <ul class="reasons">@for (r of e.reasons; track $index) { <li>{{ r }}</li> }</ul> }
            </li>
          }
        </ul>
      </section>
    }

    @let s = state();
    @if (s.kind === 'loading') {
      <mat-progress-bar mode="indeterminate" aria-label="Loading history" />
    } @else if (s.kind === 'error') {
      <p role="alert">We couldn't load the history.</p>
      <button mat-stroked-button type="button" class="btn" (click)="load()">Try again</button>
    } @else if (s.page.meta.total === 0) {
      <p class="muted">No changes recorded yet.</p>
    } @else {
      <ul class="entries">
        @for (e of s.page.data; track $index) {
          <li class="entry">
            <div class="entry__top">
              <span class="entry__market">{{ e.changed_at ? time(e.changed_at) : '' }} · {{ e.market }}</span>
              @if (e.status; as status) { <hs-status-badge [status]="status" /> } @else { <span class="muted">No longer tracked</span> }
            </div>
            @if (e.reasons.length) { <ul class="reasons">@for (r of e.reasons; track $index) { <li>{{ r }}</li> }</ul> }
          </li>
        }
      </ul>
      <mat-paginator [length]="s.page.meta.total" [pageSize]="25" [pageIndex]="page() - 1" [hidePageSize]="true" (page)="onPage($event)" aria-label="Choose history page" />
    }
  `,
  styles: `
    :host { display: grid; gap: var(--space-3); }
    .on-date { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
    .btn { min-height: 44px; }
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

  constructor() {
    effect(() => {
      this.version();
      this.productId();
      untracked(() => void this.load());
    });
  }

  async load(): Promise<void> {
    try {
      this.state.set({ kind: 'ready', page: await firstValueFrom(this.api.history(this.productId(), this.page())) });
    } catch {
      this.state.set({ kind: 'error' });
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
