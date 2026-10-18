import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { BillingApi } from '../../core/api/billing-api';
import { AccessService } from '../../core/billing/access.service';
import { Billing, BillingInterval, Invoice, OfferedPlan, PlanLimits } from '../../core/models/billing';
import { PlanKey } from '../../core/models/auth';
import { ConfirmDialog } from '../../shared/ui/confirm-dialog';

const POLL_MS = 3000;
const POLL_TIMES = 20;
const USAGE: readonly { key: keyof PlanLimits; label: string }[] = [
  { key: 'suppliers', label: 'suppliers' }, { key: 'markets', label: 'markets' }, { key: 'users', label: 'users (incl. invitations)' },
];

/** Phase 7a: plan, usage, choose or change plan, card, invoices, cancel. Only the owner can manage; everyone can see. */
@Component({
  selector: 'hs-billing-tab',
  imports: [DatePipe, MatCardModule, MatButtonModule, MatButtonToggleModule, MatProgressBarModule, MatListModule],
  template: `
    <div class="settings-grid">
      @if (billing(); as b) {
        <mat-card appearance="outlined" class="hs-card">
          <mat-card-header><mat-card-title>Your plan</mat-card-title></mat-card-header>
          <mat-card-content class="billing__summary">
            <p class="billing__line">
              @switch (b.state) {
                @case ('trial') { Trial ({{ b.plan_label }} limits) — ends on {{ b.ends_on | date: 'd MMMM y' }} }
                @case ('free') { Free {{ b.plan_label }} plan@if (b.ends_on) { — ends on {{ b.ends_on | date: 'd MMMM y' }}} }
                @case ('subscribed') { {{ b.plan_label }}, {{ b.interval === 'yearly' ? 'paid yearly' : 'paid monthly' }} }
                @case ('read_only') { Read-only — choose a plan to keep editing. Nothing has been deleted. }
              }
            </p>
            @if (waiting()) { <p class="billing__note" role="status">Thank you! We are confirming your payment with Paddle…</p> }
            @if (waitedTooLong()) { <p class="billing__note" role="status">Your payment is still being confirmed. Please refresh in a minute.</p> }
            @if (b.past_due) { <p class="billing__alert" role="alert">Payment failed — please update your card. Paddle will try again.</p> }
            @if (b.cancelled && b.ends_on) { <p class="billing__note">Cancelled: your plan stays active until {{ b.ends_on | date: 'd MMMM y' }}.</p> }
            @if (b.next_payment && !b.cancelled) { <p class="billing__note">Next payment {{ b.next_payment.date | date: 'd MMMM y' }}.</p> }

            <ul class="billing__usage">
              @for (u of usage(); track u.key) {
                <li>
                  <span>{{ u.text }}</span>
                  @if (u.percent !== null) { <mat-progress-bar mode="determinate" [value]="u.percent" [attr.aria-label]="u.text" /> }
                  @if (u.over) { <span class="billing__over">You are over the {{ b.plan_label }} limit. Nothing was removed; adding more is paused.</span> }
                </li>
              }
            </ul>

            @if (b.can_manage && b.state === 'subscribed') {
              <div class="billing__actions">
                <button mat-stroked-button type="button" (click)="updateCard()" [disabled]="busy()">Update card</button>
                @if (b.cancelled) {
                  <button mat-stroked-button type="button" (click)="resume()" [disabled]="busy()">Keep my plan</button>
                } @else {
                  <button mat-stroked-button type="button" (click)="cancel()" [disabled]="busy()">Cancel plan</button>
                }
              </div>
            }
            @if (!b.can_manage) { <p class="billing__note">Only the account owner can change the plan.</p> }
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined" class="hs-card">
          <mat-card-header><mat-card-title>Plans</mat-card-title></mat-card-header>
          <mat-card-content>
            <mat-button-toggle-group [value]="interval()" (change)="interval.set($event.value)" aria-label="Billing period" class="billing__toggle">
              <mat-button-toggle value="monthly">Monthly</mat-button-toggle>
              <mat-button-toggle value="yearly">Yearly</mat-button-toggle>
            </mat-button-toggle-group>
            <p class="billing__note">Prices in US dollars, excluding VAT or sales tax (added at checkout by Paddle, our reseller).</p>
            <div class="billing__plans">
              @for (p of b.plans; track p.plan) {
                <section class="billing__plan" [class.billing__plan--current]="isCurrent(b, p)">
                  <h3>{{ p.name }}</h3>
                  @if (price(p); as cents) {
                    <p class="billing__price">{{ money(cents) }} <span>/ {{ interval() === 'yearly' ? 'year' : 'month' }}</span></p>
                  } @else {
                    <p class="billing__price billing__price--none">Not offered {{ interval() }}</p>
                  }
                  @if (p.description) { <p class="billing__note">{{ p.description }}</p> }
                  <ul class="billing__limits">
                    <li>{{ p.limits.suppliers === null ? 'Unlimited' : p.limits.suppliers }} suppliers</li>
                    <li>{{ p.limits.markets }} {{ p.limits.markets === 1 ? 'market' : 'markets' }}</li>
                    <li>{{ p.limits.users }} users</li>
                  </ul>
                  @if (b.can_manage) {
                    @if (isCurrent(b, p)) {
                      <span class="billing__current">Your plan</span>
                    } @else if (canBuy(p) && !b.cancelled) {
                      <button mat-flat-button type="button" (click)="choose(b, p)" [disabled]="busy() || waiting()">{{ b.state === 'subscribed' ? 'Switch to ' + p.name : 'Choose ' + p.name }}</button>
                    }
                  }
                </section>
              }
            </div>
          </mat-card-content>
        </mat-card>

        @if (b.can_manage && invoices().length > 0) {
          <mat-card appearance="outlined" class="hs-card">
            <mat-card-header><mat-card-title>Invoices</mat-card-title></mat-card-header>
            <mat-card-content>
              <mat-list>
                @for (i of invoices(); track i.id) {
                  <mat-list-item>
                    <span matListItemTitle>{{ i.date | date: 'd MMM y' }} — {{ money(i.total) }}</span>
                    <button mat-button matListItemMeta type="button" (click)="openInvoice(i)">PDF</button>
                  </mat-list-item>
                }
              </mat-list>
            </mat-card-content>
          </mat-card>
        }
      } @else if (failed()) {
        <p class="billing__alert" role="alert">Billing could not be loaded. Please refresh the page.</p>
      }
    </div>
  `,
  styles: `
    .billing__line { margin: 0; font-weight: var(--weight-medium); }
    .billing__note { margin: var(--space-1) 0 0; font-size: var(--text-sm); color: var(--color-text-muted); }
    .billing__alert { margin: var(--space-2) 0 0; padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm);
      background: var(--color-danger-bg); color: var(--color-danger-fg); border: 1px solid var(--color-danger-border); }
    .billing__usage { list-style: none; margin: var(--space-4) 0 0; padding: 0; display: grid; gap: var(--space-3); }
    .billing__usage li { display: grid; gap: var(--space-1); }
    .billing__over { font-size: var(--text-sm); color: var(--color-warning-fg); }
    .billing__actions { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-4); }
    .billing__toggle { margin-bottom: var(--space-2); --mat-button-toggle-height: var(--touch-target); }
    .billing__toggle ::ng-deep .mat-button-toggle-button { min-height: var(--touch-target); }
    .billing__plans { display: grid; gap: var(--space-3); margin-top: var(--space-3); grid-template-columns: 1fr; }
    @media (min-width: 768px) { .billing__plans { grid-template-columns: repeat(3, 1fr); } }
    .billing__plan { display: grid; align-content: start; gap: var(--space-2); padding: var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
    .billing__plan--current { border-color: var(--color-primary); box-shadow: inset 0 0 0 1px var(--color-primary); }
    .billing__plan h3 { margin: 0; font-size: var(--text-lg); }
    .billing__price { margin: 0; font-size: var(--text-xl); font-weight: var(--weight-semibold); }
    .billing__price span { font-size: var(--text-sm); font-weight: var(--weight-regular); color: var(--color-text-muted); }
    .billing__price--none { font-size: var(--text-sm); color: var(--color-text-muted); }
    .billing__limits { margin: 0; padding-inline-start: var(--space-4); font-size: var(--text-sm); }
    .billing__current { font-size: var(--text-sm); font-weight: var(--weight-medium); color: var(--color-primary); }
    button { min-height: var(--touch-target); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BillingTab implements OnInit {
  private readonly api = inject(BillingApi);
  private readonly access = inject(AccessService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly billing = signal<Billing | null>(null);
  protected readonly invoices = signal<readonly Invoice[]>([]);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly waiting = signal(false);
  protected readonly waitedTooLong = signal(false);
  protected readonly interval = signal<BillingInterval>('monthly');

  protected readonly usage = computed(() => {
    const b = this.billing();
    if (b === null) {
      return [];
    }
    return USAGE.map(({ key, label }) => {
      const used = b.usage[key];
      const limit = b.limits[key];
      return {
        key,
        text: limit === null ? `${used} ${label}` : `${used} of ${limit} ${label}`,
        percent: limit === null ? null : Math.min(100, Math.round((used / Math.max(1, limit)) * 100)),
        over: limit !== null && used > limit,
      };
    });
  });

  async ngOnInit(): Promise<void> {
    await this.load();
    if (this.route.snapshot.queryParamMap.get('checkout') === 'success' && this.billing()?.state !== 'subscribed') {
      void this.poll();
    }
  }

  protected price(p: OfferedPlan): number | null {
    return this.interval() === 'yearly' ? p.yearly : p.monthly;
  }

  protected canBuy(p: OfferedPlan): boolean {
    return this.interval() === 'yearly' ? p.can_buy_yearly : p.can_buy_monthly;
  }

  protected isCurrent(b: Billing, p: OfferedPlan): boolean {
    return b.state === 'subscribed' && b.plan === p.plan && b.interval === this.interval();
  }

  protected money(cents: number): string {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
  }

  protected async choose(b: Billing, p: OfferedPlan): Promise<void> {
    if (b.state !== 'subscribed') {
      const promo = this.route.snapshot.queryParamMap.get('promo'); // from a /pricing?promo=CODE link; Paddle checks it
      window.location.assign(this.api.checkoutUrl(p.plan, this.interval()) + (promo ? `?promo=${encodeURIComponent(promo)}` : ''));
      return;
    }
    const ok = await this.confirm(`Switch to ${p.name}?`, `Paddle charges or credits the difference for the rest of this period straight away.`, `Switch to ${p.name}`);
    if (ok) {
      await this.run(() => this.api.swap(p.plan as PlanKey, this.interval()), `Your plan is now ${p.name}.`);
    }
  }

  protected async cancel(): Promise<void> {
    const ok = await this.confirm('Cancel your plan?', 'Your plan stays active until the end of the period you have paid for. After that your account becomes read-only; nothing is deleted.', 'Cancel plan');
    if (ok) {
      await this.run(() => this.api.cancel(), 'Your plan is cancelled at the end of the period.');
    }
  }

  protected async resume(): Promise<void> {
    await this.run(() => this.api.resume(), 'Your plan continues.');
  }

  protected async updateCard(): Promise<void> {
    this.busy.set(true);
    try {
      window.location.assign(await firstValueFrom(this.api.paymentMethodUrl()));
    } catch {
      this.snackBar.open('Paddle could not be reached. Please try again.', 'Close', { duration: 6000 });
    } finally {
      this.busy.set(false);
    }
  }

  protected async openInvoice(i: Invoice): Promise<void> {
    try {
      window.open(await firstValueFrom(this.api.invoiceUrl(i.id)), '_blank', 'noopener');
    } catch {
      this.snackBar.open('The invoice could not be opened. Please try again.', 'Close', { duration: 6000 });
    }
  }

  private async load(): Promise<void> {
    try {
      const b = await firstValueFrom(this.api.show());
      this.billing.set(b);
      if (b.interval !== null) {
        this.interval.set(b.interval);
      }
      if (b.can_manage && b.state === 'subscribed') {
        this.invoices.set(await firstValueFrom(this.api.invoices()));
      }
    } catch {
      this.failed.set(true);
    }
  }

  /** After Paddle's checkout the webhook may arrive a few seconds later: check every 3 s for up to a minute. */
  private async poll(): Promise<void> {
    this.waiting.set(true);
    let stopped = false;
    this.destroyRef.onDestroy(() => (stopped = true));
    for (let i = 0; i < POLL_TIMES && !stopped; i++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      try {
        const b = await firstValueFrom(this.api.show());
        this.billing.set(b);
        if (b.state === 'subscribed') {
          this.waiting.set(false);
          void this.access.refresh();
          return;
        }
      } catch {
        // keep trying
      }
    }
    this.waiting.set(false);
    this.waitedTooLong.set(!stopped);
  }

  private async run(action: () => ReturnType<BillingApi['cancel']>, done: string): Promise<void> {
    this.busy.set(true);
    try {
      this.billing.set(await firstValueFrom(action()));
      void this.access.refresh();
      this.snackBar.open(done, 'Close', { duration: 6000 });
    } catch {
      this.snackBar.open('That did not work. Please try again.', 'Close', { duration: 6000 });
    } finally {
      this.busy.set(false);
    }
  }

  private async confirm(title: string, message: string, confirmLabel: string): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialog, { data: { title, message, confirmLabel }, maxWidth: '32rem' });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}
