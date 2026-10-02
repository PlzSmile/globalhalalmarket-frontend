import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Dashboard } from './dashboard';
import { DashboardApi } from '../../core/api/dashboard-api';
import { ComplianceApi } from '../../core/api/compliance-api';
import { SuppliersApi } from '../../core/api/suppliers-api';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardData } from '../../core/models/dashboard';
import { settle } from '../../../testing/settle';

const NEW_COMPANY: DashboardData = {
  markets: [],
  onboarding: { steps: [
    { key: 'markets', status: 'todo' }, { key: 'team', status: 'todo' },
    { key: 'products', status: 'coming_soon' }, { key: 'suppliers', status: 'coming_soon' }, { key: 'certificates', status: 'coming_soon' },
  ] },
  product_count: 0,
  compliance: { computed_at: null, summary: { overall: { green: 0, amber: 0, red: 0 }, markets: [] }, upcoming_expiries: [] },
};

const WITH_MARKETS: DashboardData = {
  ...NEW_COMPANY,
  markets: [{ code: 'JAKIM', market: 'Malaysia', authority: 'JAKIM', country_code: 'MY' }],
  onboarding: { steps: NEW_COMPANY.onboarding.steps.map((s) => (s.key === 'markets' ? { ...s, status: 'done' as const } : s)) },
};

const WITH_RESULTS: DashboardData = {
  ...WITH_MARKETS,
  product_count: 2,
  compliance: {
    computed_at: '2026-09-30T10:12:00',
    summary: { overall: { green: 1, amber: 0, red: 1 }, markets: [{ code: 'JAKIM', green: 1, amber: 0, red: 1 }] },
    upcoming_expiries: [
      { kind: 'certificate', date: '2026-10-13', days_left: 13, certificate_id: 9, supplier: 'Acme Gelatin', body: 'Halal Food Council', products: 2 },
      { kind: 'recognition', date: '2026-11-02', days_left: 33, body: 'Halal Food Council', authority: 'MoIAT', products: 1 },
    ],
  },
};

function setup(get: ReturnType<typeof vi.fn>, afterClosed: unknown = undefined, canManage = true) {
  const snackBar = { open: vi.fn() };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(afterClosed) })) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: DashboardApi, useValue: { get } },
      { provide: ComplianceApi, useValue: { products: vi.fn(() => of({ data: [], meta: { current_page: 1, last_page: 1, per_page: 25, total: 0 } })) } },
      { provide: SuppliersApi, useValue: { search: vi.fn(() => of([])), get: vi.fn() } },
      { provide: AuthService, useValue: { canManageTeam: () => canManage } },
      { provide: MatDialog, useValue: dialog },
      { provide: MatSnackBar, useValue: snackBar },
    ],
  });
  const fixture = TestBed.createComponent(Dashboard);
  return { fixture, dialog, snackBar, el: fixture.nativeElement as HTMLElement };
}

describe('Dashboard', () => {
  it('shows a progress bar while loading, then the data', async () => {
    const response = new Subject<DashboardData>();
    const { fixture, el } = setup(vi.fn(() => response.asObservable()));
    fixture.detectChanges();
    expect(el.querySelector('mat-progress-bar')).not.toBeNull();
    response.next(NEW_COMPANY);
    response.complete();
    await settle(fixture);
    expect(el.querySelector('mat-progress-bar')).toBeNull();
    expect(el.textContent).toContain('Getting started');
  });

  it('shows an error with Try again, which reloads', async () => {
    const get = vi.fn().mockReturnValueOnce(throwError(() => new Error('down'))).mockReturnValue(of(NEW_COMPANY));
    const { fixture, el } = setup(get);
    await settle(fixture);
    expect(el.textContent).toContain("We couldn't load your dashboard.");
    (el.querySelector('[data-test="retry"]') as HTMLButtonElement).click();
    await settle(fixture);
    expect(get).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('Getting started');
  });

  it('shows no sample data: chosen markets as chips and the empty state', async () => {
    const { fixture, el } = setup(vi.fn(() => of(WITH_MARKETS)));
    await settle(fixture);
    expect(el.textContent).not.toContain('Chicken sausage');
    expect(el.querySelector('[data-test="market-chip"]')?.textContent).toContain('Malaysia · JAKIM');
    expect(el.textContent).toContain('Add your first product');
  });

  it('says so when no markets are chosen yet', async () => {
    const { fixture, el } = setup(vi.fn(() => of(NEW_COMPANY)));
    await settle(fixture);
    expect(el.textContent).toContain('No markets chosen yet.');
  });

  it('hides Getting started once every step is done', async () => {
    const allDone: DashboardData = { ...WITH_MARKETS, onboarding: { steps: NEW_COMPANY.onboarding.steps.map((s) => ({ ...s, status: 'done' as const })) } };
    const { fixture, el } = setup(vi.fn(() => of(allDone)));
    await settle(fixture);
    expect(el.textContent).not.toContain('Getting started');
  });

  it('reloads and confirms after markets are saved in the dialog', async () => {
    const get = vi.fn(() => of(NEW_COMPANY));
    const { fixture, dialog, snackBar } = setup(get, [{ code: 'JAKIM' }]);
    await settle(fixture);
    await fixture.componentInstance.chooseMarkets();
    expect(dialog.open).toHaveBeenCalled();
    expect(snackBar.open).toHaveBeenCalledWith('Markets saved.', 'Close', { duration: 4000 });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('does nothing when the dialog is cancelled', async () => {
    const get = vi.fn(() => of(NEW_COMPANY));
    const { fixture, snackBar } = setup(get, undefined);
    await settle(fixture);
    await fixture.componentInstance.chooseMarkets();
    expect(snackBar.open).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('hides the markets Edit button from members', async () => {
    const { fixture, el } = setup(vi.fn(() => of(WITH_MARKETS)), undefined, false);
    await settle(fixture);
    expect(el.querySelector('[data-test="edit-markets"]')).toBeNull();
  });

  it('shows the summary, the expiries and the updated time', async () => {
    const { fixture, el } = setup(vi.fn(() => of(WITH_RESULTS)));
    await settle(fixture);
    expect(el.querySelector('[data-test="updated"]')?.textContent).toContain('Updated 30 Sep 2026, 10:12');
    expect(el.querySelector('[data-test="count-all-red"]')?.textContent).toContain('1');
    expect(el.textContent).toContain('13 Oct 2026 · 13 days');
    expect(el.textContent).toContain('Acme Gelatin — Halal Food Council certificate');
    expect(el.textContent).toContain('Halal Food Council — MoIAT recognition');
    expect(el.querySelector('hs-compliance-matrix')).not.toBeNull();
  });

  it('a summary number filters the matrix through the URL', async () => {
    const { fixture, el } = setup(vi.fn(() => of(WITH_RESULTS)));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await settle(fixture);
    (el.querySelector('[data-test="count-JAKIM-red"]') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { market: 'JAKIM', status: 'red', page: null }, queryParamsHandling: 'merge' }));
  });
});
