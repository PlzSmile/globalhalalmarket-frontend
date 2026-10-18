import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AccessService } from '../../core/billing/access.service';
import { AuthService } from '../../core/auth/auth.service';

/** Phase 7a: one line above every page — trial end, failed payment, or read-only. Nothing for paying or free companies. */
@Component({
  selector: 'hs-access-banner',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule],
  template: `
    @if (notice(); as n) {
      <div class="access-banner" [class.access-banner--warning]="n.tone === 'warning'" [class.access-banner--danger]="n.tone === 'danger'" role="status">
        <mat-icon svgIcon="alert" aria-hidden="true" />
        <p class="access-banner__text">
          @switch (n.kind) {
            @case ('trial') { Your free trial ends on {{ n.date | date: 'd MMMM y' }}. }
            @case ('past_due') { Payment failed — please update your card. }
            @case ('read_only') { Your access has ended — choose a plan to keep editing. Nothing has been deleted. }
          }
        </p>
        @if (isOwner()) {
          <a mat-flat-button routerLink="/settings" [queryParams]="{ tab: 'billing' }">{{ n.kind === 'past_due' ? 'Update card' : 'Choose a plan' }}</a>
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
    a[mat-flat-button] { min-height: var(--touch-target); }
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
      return { kind: 'trial', tone: 'warning', date: a.ends_on } as const;
    }
    return null;
  });

  ngOnInit(): void {
    void this.service.refresh();
  }
}
