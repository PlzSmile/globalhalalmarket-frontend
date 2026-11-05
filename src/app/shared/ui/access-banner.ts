import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AccessService } from '../../core/billing/access.service';
import { AuthService } from '../../core/auth/auth.service';

/** The trial banner turns into a warning this many days before the end. */
export const TRIAL_WARNING_DAYS = 3;

/** Whole days from today to the trial's last day ("2026-11-19" or a timestamp): 0 = ends today. */
export function trialDaysLeft(endsOn: string, now: Date): number {
  const end = new Date(endsOn.length === 10 ? endsOn + 'T00:00:00' : endsOn);
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.max(0, Math.round((day(end) - day(now)) / 86_400_000));
}

/** Phase 7a: one line above every page — trial end, failed payment, or read-only. Nothing for paying or free companies. */
@Component({
  selector: 'hs-access-banner',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule],
  template: `
    @if (notice(); as n) {
      <div class="access-banner" [class.access-banner--info]="n.tone === 'info'" [class.access-banner--warning]="n.tone === 'warning'" [class.access-banner--danger]="n.tone === 'danger'" role="status">
        <mat-icon [svgIcon]="n.tone === 'info' ? 'info' : 'alert'" aria-hidden="true" />
        <p class="access-banner__text">
          @switch (n.kind) {
            @case ('trial') {
              @if (n.daysLeft > 1) { Free trial: <strong>{{ n.daysLeft }} days left</strong> (until {{ n.date | date: 'd MMMM y' }}). }
              @else if (n.daysLeft === 1) { Your free trial ends <strong>tomorrow</strong>. Choose a plan to keep editing. }
              @else { Your free trial ends <strong>today</strong>. Choose a plan to keep editing. }
            }
            @case ('past_due') { Payment failed — please update your card. }
            @case ('read_only') { Your access has ended — choose a plan to keep editing. Nothing has been deleted. }
          }
        </p>
        @if (isOwner()) {
          @if (n.tone === 'info') {
            <a mat-stroked-button routerLink="/settings" [queryParams]="{ tab: 'billing' }">See plans</a>
          } @else {
            <a mat-flat-button routerLink="/settings" [queryParams]="{ tab: 'billing' }">{{ n.kind === 'past_due' ? 'Update card' : 'Choose a plan' }}</a>
          }
        } @else if (n.kind !== 'trial') {
          <span class="access-banner__hint">Ask your account owner.</span>
        }
      </div>
    }
  `,
  styles: `
    .access-banner { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-3); padding: var(--space-3) var(--space-4);
      margin-bottom: var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--color-border); background: var(--color-surface-muted); }
    .access-banner--warning { border-color: var(--color-warning-border); background: var(--color-warning-bg); color: var(--color-warning-fg); }
    .access-banner--danger { border-color: var(--color-danger-border); background: var(--color-danger-bg); color: var(--color-danger-fg); }
    .access-banner__text { margin: 0; flex: 1 1 16rem; }
    .access-banner__hint { font-size: var(--text-sm); color: var(--color-text-muted); }
    .access-banner--info mat-icon { color: var(--color-primary); }
    a[mat-flat-button], a[mat-stroked-button] { min-height: var(--touch-target); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessBanner implements OnInit {
  private readonly service = inject(AccessService);
  private readonly auth = inject(AuthService);
  protected readonly isOwner = computed(() => this.auth.user()?.role === 'owner');
  protected readonly notice = computed(() => {
    const a = this.service.access();
    if (a === null) {
      return null;
    }
    if (a.state === 'read_only') {
      return { kind: 'read_only', tone: 'danger', date: null } as const;
    }
    if (a.past_due) {
      return { kind: 'past_due', tone: 'danger', date: null } as const;
    }
    if (a.state === 'trial' && a.ends_on !== null) {
      // 5 Nov 2026 (launch prep): a calm note for most of the trial; a warning only in the last 3 days.
      const daysLeft = trialDaysLeft(a.ends_on, new Date());
      return { kind: 'trial', tone: daysLeft <= TRIAL_WARNING_DAYS ? 'warning' : 'info', date: a.ends_on, daysLeft } as const;
    }
    return null;
  });

  ngOnInit(): void {
    void this.service.refresh();
  }
}
