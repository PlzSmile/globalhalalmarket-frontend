import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AccessBanner } from './access-banner';
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
  it('shows when the trial ends, with Choose a plan for the owner', async () => {
    const text = await render(BASE);
    expect(text).toContain('Your free trial ends on 1 November 2026');
    expect(text).toContain('Choose a plan');
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
