import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PlanCard } from './plan-card';
import { MeApi } from '../../core/api/me-api';
import { CompanyAccess } from '../../core/models/auth';
import { settle } from '../../../testing/settle';

async function render(access: CompanyAccess | null, fail = false) {
  const api = { company: vi.fn(() => (fail ? throwError(() => new Error('x')) : of({ id: 5, name: 'Khan Foods', access: access ?? undefined }))) };
  TestBed.configureTestingModule({ providers: [{ provide: MeApi, useValue: api }] });
  const fixture = TestBed.createComponent(PlanCard);
  await settle(fixture);
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

describe('PlanCard', () => {
  it('shows the free plan and when it ends', async () => {
    const text = await render({ plan: 'pro', plan_label: 'Pro', free: true, free_until: '2027-01-07', offer: 'Launch' });
    expect(text).toContain('Free Pro plan until 7 January 2027');
  });

  it('shows free access with no end date', async () => {
    const text = await render({ plan: 'pro', plan_label: 'Pro', free: true, free_until: null, offer: null });
    expect(text).toContain('Free Pro plan');
    expect(text).not.toContain('until');
  });

  it('says when free access has ended', async () => {
    const text = await render({ plan: 'pro', plan_label: 'Pro', free: false, free_until: '2026-10-01', offer: null });
    expect(text).toContain('Your free Pro plan ended on 1 October 2026');
  });

  it('shows early access when there is no plan yet, and nothing when loading fails', async () => {
    expect(await render({ plan: null, plan_label: null, free: false, free_until: null, offer: null })).toContain('Early access');
    TestBed.resetTestingModule();
    expect(await render(null, true)).not.toContain('Plan');
  });
});
