import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { ActivityApi, ActivityEntry } from '../../core/api/activity-api';
import { ukDateTime } from '../../shared/format/uk-date';
import { EmptyState } from '../../shared/ui/empty-state';

/** Phase 7: who changed what in the company, newest first (owners and admins; kept for 12 months). */
@Component({
  selector: 'hs-activity-tab',
  imports: [RouterLink, MatButtonModule, EmptyState],
  template: `
    <div class="settings-grid activity">
      <p class="lead">Who changed what in your company, newest first. Kept for 12 months.</p>
      @if (entries(); as list) {
        @if (list.length === 0) {
          <hs-empty-state icon="clock" heading="Nothing yet" text="Changes to products, suppliers, certificates, markets and the team will appear here." />
        } @else {
          <ol class="activity__list">
            @for (entry of list; track entry.id) {
              <li class="activity__item" data-test="activity-item">
                <div class="activity__meta"><span class="activity__actor">{{ entry.actor }}</span><span class="activity__time">{{ time(entry.at) }}</span></div>
                <p class="activity__text">
                  @if (entry.link) { <a [routerLink]="entry.link">{{ entry.description }}</a> } @else { {{ entry.description }} }
                </p>
                @if (entry.changes.length) {
                  <ul class="activity__changes">
                    @for (change of entry.changes; track change.field) {
                      <li><span class="activity__field">{{ change.field }}:</span> {{ change.from ?? '—' }} → {{ change.to ?? '—' }}</li>
                    }
                  </ul>
                }
              </li>
            }
          </ol>
          @if (next()) {
            <button mat-stroked-button type="button" class="activity__more" (click)="more()" [disabled]="busy()" data-test="activity-more">Show older</button>
          }
        }
      }
    </div>
  `,
  styles: `
    .lead { color: var(--color-text-muted); margin: 0; }
    .activity__list { list-style: none; margin: 0; padding: 0; display: grid; }
    .activity__item { padding: var(--space-3) 0; border-bottom: 1px solid var(--color-border); display: grid; gap: var(--space-1); }
    .activity__meta { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--space-2); font-size: var(--text-sm); color: var(--color-text-muted); }
    .activity__actor { font-weight: var(--weight-semibold); color: var(--color-text); }
    .activity__text { margin: 0; overflow-wrap: anywhere; }
    .activity__changes { margin: 0; padding-left: var(--space-5); font-size: var(--text-sm); color: var(--color-text-muted); overflow-wrap: anywhere; }
    .activity__field { color: var(--color-text); }
    .activity__more { justify-self: start; min-height: var(--touch-target); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityTab implements OnInit {
  private readonly api = inject(ActivityApi);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly entries = signal<readonly ActivityEntry[] | null>(null);
  protected readonly next = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly time = ukDateTime;

  ngOnInit(): Promise<void> {
    return this.load(null);
  }

  protected more(): Promise<void> {
    return this.load(this.next());
  }

  private async load(cursor: string | null): Promise<void> {
    this.busy.set(true);
    try {
      const page = await firstValueFrom(this.api.page(cursor));
      this.entries.set([...(cursor ? (this.entries() ?? []) : []), ...page.data]);
      this.next.set(page.meta.next_cursor);
    } catch {
      this.snackBar.open('The activity log could not be loaded. Please try again.', 'Close', { duration: 6000 });
    } finally {
      this.busy.set(false);
    }
  }
}
