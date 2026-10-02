import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ComplianceBreakdown } from './compliance-breakdown';
import { CertificatesApi } from '../../core/api/certificates-api';
import { MarketBreakdown } from '../../core/models/compliance';
import { settle } from '../../../testing/settle';

const MARKETS: readonly MarketBreakdown[] = [
  { market: 'BPJPH', authority: 'BPJPH', status: 'green', next_expiry_on: '2027-06-01', reasons: [], ingredients: [
    { id: 3, name: 'Gelatin', status: 'green', reasons: [], certificates: [
      { id: 9, supplier: 'Acme Gelatin', body: 'Halal Food Council', expires_on: '2027-06-01', scope: 'Gelatin products', authority_scopes: ['Meat', 'Gelatin'],
        scope_check: { result: 'covers', note: 'Page 2', by: 'Ana', at: '2026-09-30T10:00:00+00:00' } },
    ] },
  ] },
  { market: 'JAKIM', authority: 'JAKIM', status: 'red', next_expiry_on: null, reasons: ['Gelatin — Halal Food Council: not listed by JAKIM'], ingredients: [
    { id: 3, name: 'Gelatin', status: 'red', reasons: ['Halal Food Council: not listed by JAKIM'], certificates: [
      { id: 9, supplier: 'Acme Gelatin', body: 'Halal Food Council', expires_on: '2027-06-01', scope: null, authority_scopes: null, scope_check: null },
    ] },
  ] },
];

function setup(canManage: boolean, market: string | null = null, dialogResult: unknown = undefined) {
  const certificates = { clearScopeCheck: vi.fn(() => of(undefined)) };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) };
  const snackBar = { open: vi.fn() };
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: CertificatesApi, useValue: certificates }, { provide: MatDialog, useValue: dialog }, { provide: MatSnackBar, useValue: snackBar }],
  });
  const fixture = TestBed.createComponent(ComplianceBreakdown);
  fixture.componentRef.setInput('markets', MARKETS);
  fixture.componentRef.setInput('canManage', canManage);
  fixture.componentRef.setInput('market', market);
  const changed = vi.fn();
  fixture.componentInstance.changed.subscribe(changed);
  return { fixture, certificates, dialog, snackBar, changed, el: fixture.nativeElement as HTMLElement };
}

describe('ComplianceBreakdown', () => {
  it('lists each market with its reasons and both scope texts', async () => {
    const { fixture, el } = setup(false);
    await settle(fixture);
    expect(el.textContent).toContain('Gelatin — Halal Food Council: not listed by JAKIM');
    expect(el.textContent).toContain('Gelatin products');
    expect(el.textContent).toContain('Meat, Gelatin');
    expect(el.textContent).toContain('Not published by the authority');
    expect(el.textContent).toContain('Not given on the certificate');
    expect(el.textContent).toContain('Scope covers this market — Ana, 30 Sep 2026');
    expect(el.textContent).toContain('Valid until 1 Jun 2027');
  });

  it('shows only the chosen market', async () => {
    const { fixture, el } = setup(false, 'JAKIM');
    await settle(fixture);
    expect(el.querySelectorAll('section.market').length).toBe(1);
    expect(el.querySelector('h3')?.textContent).toContain('JAKIM');
  });

  it('lets only owners and admins decide, and tells the parent after a change', async () => {
    const member = setup(false);
    await settle(member.fixture);
    expect(member.el.querySelector('[data-test="check-scope"]')).toBeNull();
    TestBed.resetTestingModule();

    const saved = { result: 'not_covered', note: null, by: 'Ana', at: '2026-09-30T10:00:00+00:00' };
    const { fixture, el, dialog, changed, certificates, snackBar } = setup(true, null, saved);
    await settle(fixture);
    (el.querySelectorAll('[data-test="check-scope"]')[1] as HTMLButtonElement).click();
    await settle(fixture);
    const data = (dialog.open.mock.calls[0] as unknown[])[1] as { data: { certificateId: number; authorityCode: string; current: unknown } };
    expect(data.data).toEqual(expect.objectContaining({ certificateId: 9, authorityCode: 'JAKIM', current: null }));
    expect(changed).toHaveBeenCalledTimes(1);
    expect(snackBar.open).toHaveBeenCalledWith('Scope decision saved.', 'Close', { duration: 4000 });

    (el.querySelector('[data-test="clear-scope"]') as HTMLButtonElement).click();
    await settle(fixture);
    expect(certificates.clearScopeCheck).toHaveBeenCalledWith(9, 'BPJPH');
    expect(changed).toHaveBeenCalledTimes(2);
  });
});
