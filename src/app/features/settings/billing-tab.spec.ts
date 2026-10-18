import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { BillingTab } from './billing-tab';
import { BillingApi } from '../../core/api/billing-api';
import { AccessService } from '../../core/billing/access.service';
import { Billing, OfferedPlan } from '../../core/models/billing';
import { settle } from '../../../testing/settle';

const STARTER: OfferedPlan = { plan: 'starter', name: 'Starter', description: null, limits: { suppliers: 50, markets: 2, users: 2 }, monthly: 4900, yearly: 49000, can_buy_monthly: true, can_buy_yearly: true };
const PRO: OfferedPlan = { plan: 'pro', name: 'Pro', description: null, limits: { suppliers: null, markets: 3, users: 5 }, monthly: 9900, yearly: 99000, can_buy_monthly: true, can_buy_yearly: true };
const BASE: Billing = {
  state: 'trial', plan: 'pro', plan_label: 'Pro', interval: null, ends_on: '2026-11-01', next_payment: null, cancelled: false, past_due: false, can_manage: true,
  usage: { suppliers: 3, markets: 2, users: 1 }, limits: { suppliers: null, markets: 3, users: 5 }, plans: [STARTER, PRO],
};

async function render(billing: Billing, query: Record<string, string> = {}, api: Partial<Record<keyof BillingApi, unknown>> = {}) {
  const billingApi = { show: vi.fn(() => of(billing)), invoices: vi.fn(() => of([])), checkoutUrl: vi.fn(() => '/billing/checkout/x/y'), ...api };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BillingApi, useValue: billingApi },
      { provide: AccessService, useValue: { refresh: vi.fn() } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
    ],
  });
  const fixture = TestBed.createComponent(BillingTab);
  await settle(fixture);
  return { fixture, billingApi, text: () => (fixture.nativeElement as HTMLElement).textContent ?? '' };
}

describe('BillingTab', () => {
  it('shows the trial end, usage and plan prices', async () => {
    const { text } = await render(BASE);
    expect(text()).toContain('Trial (Pro limits) — ends on 1 November 2026');
    expect(text()).toContain('3 suppliers'); // unlimited on the trial
    expect(text()).toContain('2 of 3 markets');
    expect(text()).toContain('US$49');
    expect(text()).toContain('Choose Starter');
  });

  it('shows "of" and an over-the-limit line on Starter', async () => {
    const { text } = await render({ ...BASE, state: 'subscribed', plan: 'starter', plan_label: 'Starter', interval: 'monthly', ends_on: null,
      usage: { suppliers: 64, markets: 2, users: 1 }, limits: { suppliers: 50, markets: 2, users: 2 } });
    expect(text()).toContain('64 of 50 suppliers');
    expect(text()).toContain('You are over the Starter limit');
    expect(text()).toContain('Your plan');
    expect(text()).toContain('Switch to Pro');
    expect(text()).toContain('Cancel plan');
  });

  it('on a cancelled plan offers Keep my plan instead of switching', async () => {
    const { text } = await render({ ...BASE, state: 'subscribed', plan: 'starter', plan_label: 'Starter', interval: 'monthly', cancelled: true, ends_on: '2026-11-18' });
    expect(text()).toContain('Keep my plan');
    expect(text()).toContain('stays active until 18 November 2026');
    expect(text()).not.toContain('Switch to Pro');
  });

  it('hides every management button when the user is not the owner', async () => {
    const { text } = await render({ ...BASE, can_manage: false });
    expect(text()).toContain('Only the account owner can change the plan');
    expect(text()).not.toContain('Choose Starter');
  });

  it('asks to update the card when a payment failed', async () => {
    const { text } = await render({ ...BASE, state: 'subscribed', interval: 'monthly', past_due: true, ends_on: null });
    expect(text()).toContain('Payment failed — please update your card');
  });

  it('after the checkout it checks until the subscription arrives', async () => {
    vi.useFakeTimers();
    try {
      const show = vi.fn().mockReturnValueOnce(of(BASE)).mockReturnValueOnce(of(BASE)).mockReturnValue(of({ ...BASE, state: 'subscribed', interval: 'monthly', ends_on: null }));
      const { fixture, text } = await renderWithTimers({ checkout: 'success' }, show);
      expect(text()).toContain('We are confirming your payment');
      await vi.advanceTimersByTimeAsync(3000);
      await vi.advanceTimersByTimeAsync(3000);
      fixture.detectChanges();
      expect(text()).not.toContain('We are confirming your payment');
      expect(text()).toContain('Pro, paid monthly');
      expect(show).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

async function renderWithTimers(query: Record<string, string>, show: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BillingApi, useValue: { show, invoices: vi.fn(() => of([])) } },
      { provide: AccessService, useValue: { refresh: vi.fn() } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
    ],
  });
  const fixture = TestBed.createComponent(BillingTab);
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(0);
  fixture.detectChanges();
  return { fixture, text: () => (fixture.nativeElement as HTMLElement).textContent ?? '' };
}
