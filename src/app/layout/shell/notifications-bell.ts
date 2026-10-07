import { ChangeDetectionStrategy, Component, DestroyRef, DOCUMENT, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { NotificationsApi } from '../../core/api/notifications-api';
import { AppNotification, NotificationPage } from '../../core/models/notifications';
import { ukDateTime } from '../../shared/format/uk-date';

const EMPTY: NotificationPage = { data: [], meta: { current_page: 1, last_page: 1, total: 0, unread: 0 } };

/** Phase 6b: the bell in the toolbar — reminders and alerts, with an unread count. */
@Component({
  selector: 'hs-notifications-bell',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  template: `
    <button mat-icon-button type="button" class="bell__button" [matMenuTriggerFor]="menu" (menuOpened)="load()" matTooltip="Notifications"
            [attr.aria-label]="unread() > 0 ? 'Notifications, ' + unread() + ' unread' : 'Notifications'">
      <mat-icon svgIcon="bell" />
      @if (unread() > 0) { <span class="bell__badge" aria-hidden="true">{{ unread() > 9 ? '9+' : unread() }}</span> }
    </button>
    <mat-menu #menu="matMenu" xPosition="before" class="bell-menu">
      <div class="bell" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
        <div class="bell__head">
          <strong>Notifications</strong>
          @if (unread() > 0) {
            <button mat-button type="button" class="bell__all" (click)="markAllRead()" data-test="read-all">Mark all as read</button>
          }
        </div>
        @for (n of page().data; track n.id) {
          <button type="button" class="bell__item" [class.bell__item--unread]="!n.read" (click)="open(n)" [attr.data-test]="'notification-' + n.id">
            <span class="bell__title">{{ n.title }}</span>
            @for (line of summary(n); track $index) { <span class="bell__line">{{ line }}</span> }
            @if (n.created_at) { <span class="bell__time">{{ time(n.created_at) }}</span> }
          </button>
        } @empty {
          <p class="bell__empty">No notifications yet. Reminders appear here 60, 30 and 7 days before something expires.</p>
        }
      </div>
    </mat-menu>
  `,
  styles: `
    .bell__button { position: relative; }
    .bell__badge { position: absolute; top: var(--space-1); right: var(--space-1); min-width: 1.1rem; height: 1.1rem; padding: 0 var(--space-1);
      border-radius: var(--radius-pill); background: var(--color-danger-fg); color: var(--color-surface); font-size: var(--text-xs);
      font-weight: var(--weight-semibold); line-height: 1.1rem; text-align: center; pointer-events: none; }
    .bell { width: min(92vw, 380px); max-height: 70vh; overflow-y: auto; padding: var(--space-2) 0; }
    .bell__head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); padding: 0 var(--space-4) var(--space-2); min-height: var(--touch-target); }
    .bell__all { min-height: var(--touch-target); }
    .bell__item { display: grid; gap: var(--space-1); width: 100%; text-align: left; padding: var(--space-3) var(--space-4); border: 0; border-top: 1px solid var(--color-border);
      background: transparent; color: inherit; font: inherit; cursor: pointer; min-height: var(--touch-target); }
    .bell__item:hover, .bell__item:focus-visible { background: var(--color-surface-muted); }
    .bell__item--unread { box-shadow: inset 3px 0 0 var(--color-primary); }
    .bell__title { font-weight: var(--weight-semibold); }
    .bell__line { font-size: var(--text-sm); color: var(--color-text-muted); }
    .bell__time { font-size: var(--text-xs); color: var(--color-text-subtle); }
    .bell__empty { padding: var(--space-3) var(--space-4); color: var(--color-text-muted); font-size: var(--text-sm); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsBell implements OnInit {
  private readonly api = inject(NotificationsApi);
  protected readonly page = signal<NotificationPage>(EMPTY);
  protected readonly unread = computed(() => this.page().meta.unread);
  protected readonly time = ukDateTime;

  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  ngOnInit(): void {
    void this.load();
    // New reminders arrive in the morning while a tab may stay open: refresh now and then, and when the user comes back.
    const timer = setInterval(() => void this.load(), 120_000);
    const onVisible = (): void => {
      if (this.document.visibilityState === 'visible') {
        void this.load();
      }
    };
    this.document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      this.document.removeEventListener('visibilitychange', onVisible);
    });
  }

  async load(): Promise<void> {
    try {
      this.page.set(await firstValueFrom(this.api.list()));
    } catch {
      // The bell is a convenience: a failed load keeps what is shown.
    }
  }

  /** Up to three short lines under a notification's title. */
  protected summary(n: AppNotification): string[] {
    const lines = n.items.length > 0
      ? n.items.map((i) => `${i.title} (${i.date})`)
      : n.products.map((p) => `${p.name} — ${p.market}`);
    return lines.length > 3 ? [...lines.slice(0, 3), `and ${lines.length - 3} more`] : lines;
  }

  protected async open(n: AppNotification): Promise<void> {
    if (n.read) {
      return;
    }
    await firstValueFrom(this.api.read(n.id));
    this.page.update((p) => ({
      data: p.data.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
      meta: { ...p.meta, unread: Math.max(0, p.meta.unread - 1) },
    }));
  }

  protected async markAllRead(): Promise<void> {
    await firstValueFrom(this.api.readAll());
    this.page.update((p) => ({ data: p.data.map((x) => ({ ...x, read: true })), meta: { ...p.meta, unread: 0 } }));
  }
}
