import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AccessBanner, trialDaysLeft } from './access-banner';
import { AccessService } from '../../core/billing/access.service';
import { AuthService } from '../../core/auth/auth.service';
import { CompanyAccess } from '../../core/models/auth';
import { settle } from '../../../testing/settle';

const BASE: CompanyAccess = { state: 'trial', plan: 'pro', plan_label: 'Pro', ends_on: '2026-11-01', can_write: true, past_due: false, free: false, free_until: null };

async function render(access: CompanyAccess | null, role = 'owner'): Promise<string> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AccessService, useValue: { access: signal(access), refresh: vi.fn() } },
      { provide: AuthService, useValue: { user: signal({ role }) } },
    ],
  });
  const fixture = TestBed.createComponent(AccessBanner);
  await settle(fixture);
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('AccessBanner', () => {
  afterEach(() => vi.useRealTimers());

  it('is a calm note with the days left for most of the trial (5 Nov 2026: no warning on day one)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 18, 10, 0)); // 18 Oct, trial until 1 Nov
    TestBed.resetTestingModule();
    const text = await render(BASE);
    expect(text).toContain('Free trial: 14 days left (until 1 November 2026)');
    expect(text).toContain('See plans');
    expect(document.querySelector('.access-banner--info')).not.toBeNull();
  });

  it('warns in the last 3 days, with Choose a plan for the owner', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 31, 10, 0)); // 31 Oct
    const text = await render(BASE);
    expect(text).toContain('Your free trial ends tomorrow');
    expect(text).toContain('Choose a plan');
  });

  it('counts whole days left', () => {
    expect(trialDaysLeft('2026-11-01', new Date(2026, 10, 1, 23, 0))).toBe(0);
    expect(trialDaysLeft('2026-11-01', new Date(2026, 9, 29, 8, 0))).toBe(3);
    expect(trialDaysLeft('2026-11-01', new Date(2026, 10, 3))).toBe(0); // past: never negative
  });

  it('says read-only and tells other roles to ask the owner', async () => {
    const text = await render({ ...BASE, state: 'read_only', can_write: false, ends_on: null }, 'member');
    expect(text).toContain('Your access has ended');
    expect(text).toContain('Nothing has been deleted');
    expect(text).toContain('Ask your account owner');
    expect(text).not.toContain('Choose a plan');
  });

  it('asks to update the card when a payment failed', async () => {
    expect(await render({ ...BASE, state: 'subscribed', past_due: true, ends_on: null })).toContain('Payment failed');
  });

  it('shows nothing for paying or free companies', async () => {
    expect((await render({ ...BASE, state: 'subscribed', ends_on: null })).trim()).toBe('');
    TestBed.resetTestingModule();
    expect((await render({ ...BASE, state: 'free', ends_on: '2027-01-07', free: true })).trim()).toBe('');
  });
});
