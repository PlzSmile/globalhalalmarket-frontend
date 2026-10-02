import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ComplianceMatrix } from './compliance-matrix';
import { ComplianceApi } from '../../core/api/compliance-api';
import { SuppliersApi } from '../../core/api/suppliers-api';
import { DashboardMarket } from '../../core/models/dashboard';
import { settle } from '../../../testing/settle';

const MARKETS: readonly DashboardMarket[] = [
  { code: 'JAKIM', market: 'Malaysia', authority: 'JAKIM', country_code: 'MY' },
  { code: 'MOIAT', market: 'UAE', authority: 'MoIAT', country_code: 'AE' },
];
const PAGE = { data: [
  { id: 3, name: 'Beef sausage', sku: 'BS-1', status: 'red', cells: [
    { market: 'JAKIM', status: 'amber', reason: 'Gelatin — Acme Gelatin: valid, certificate expires on 13 Oct 2026', reasons_count: 1, next_expiry_on: '2026-10-13' },
    { market: 'MOIAT', status: 'red', reason: 'Gelatin — Halal Food Council: not listed by MoIAT', reasons_count: 1, next_expiry_on: null },
  ] },
  { id: 4, name: 'Apple juice', sku: null, status: null, cells: [
    { market: 'JAKIM', status: null, reason: 'Not calculated yet', reasons_count: 0, next_expiry_on: null },
    { market: 'MOIAT', status: null, reason: 'Not calculated yet', reasons_count: 0, next_expiry_on: null },
  ] },
], meta: { current_page: 1, last_page: 1, per_page: 25, total: 2 } };

/** Uses the real router: the URL is the matrix's only source of filters. */
async function setup(url = '/', products = vi.fn(() => of(PAGE))) {
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(undefined) })) };
  const suppliers = { search: vi.fn(() => of([{ id: 7, name: 'Acme Gelatin' }])), get: vi.fn(() => of({ id: 7, name: 'Acme Gelatin' })) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ComplianceApi, useValue: { products } },
      { provide: SuppliersApi, useValue: suppliers },
      { provide: MatDialog, useValue: dialog },
    ],
  });
  const router = TestBed.inject(Router);
  await router.navigateByUrl(url);
  const fixture = TestBed.createComponent(ComplianceMatrix);
  fixture.componentRef.setInput('markets', MARKETS);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matrix = fixture.componentInstance as unknown as Record<string, any>;
  return { fixture, matrix, products, dialog, suppliers, router, el: fixture.nativeElement as HTMLElement };
}

describe('ComplianceMatrix', () => {
  it('loads the filters from the URL and shows a badge per market', async () => {
    const { fixture, products, suppliers, el } = await setup('/?market=MOIAT&status=red&supplier=7&q=beef&page=2');
    await settle(fixture);
    expect(products).toHaveBeenCalledWith({ market: 'MOIAT', status: 'red', supplier: 7, search: 'beef', page: 2 });
    expect(suppliers.get).toHaveBeenCalledWith(7);
    expect(el.textContent).toContain('Supplier: Acme Gelatin');
    expect(el.textContent).toContain('Valid · expires soon');
    expect(el.textContent).toContain('Expires 13 Oct 2026');
    expect(el.textContent).toContain('Not calculated yet');
    expect(el.querySelectorAll('[data-test="cell"]').length).toBe(4);
  });

  it('ignores unknown values in the URL', async () => {
    const { fixture, products } = await setup('/?market=BPJPH&status=purple&supplier=x&page=-1');
    await settle(fixture);
    expect(products).toHaveBeenCalledWith({ market: null, status: null, supplier: null, search: '', page: 1 });
  });

  it('writes filter changes to the URL (page back to 1)', async () => {
    const { fixture, matrix, router } = await setup('/?page=3');
    await settle(fixture);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    matrix['go']({ status: 'amber', page: 1 });
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { market: null, status: 'amber', supplier: null, q: null, page: null }, queryParamsHandling: 'merge', replaceUrl: true,
    }));
  });

  it('reloads when the URL changes and opens the reasons for a tapped cell', async () => {
    const { fixture, products, router, dialog, el } = await setup();
    await settle(fixture);
    await router.navigateByUrl('/?status=green');
    await settle(fixture);
    expect(products).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'green' }));

    (el.querySelectorAll('[data-test="cell"]')[1] as HTMLButtonElement).click();
    await settle(fixture);
    const data = (dialog.open.mock.calls[0] as unknown[])[1] as { data: unknown };
    expect(data.data).toEqual({ productId: 3, productName: 'Beef sausage', market: 'MOIAT' });
  });

  it('shows an empty state and an error state', async () => {
    const empty = await setup('/', vi.fn(() => of({ data: [], meta: { current_page: 1, last_page: 1, per_page: 25, total: 0 } })));
    await settle(empty.fixture);
    expect(empty.el.textContent).toContain('No products match these filters.');
    TestBed.resetTestingModule();

    const failing = await setup('/', vi.fn(() => throwError(() => new Error('offline'))));
    await settle(failing.fixture);
    expect(failing.el.textContent).toContain("We couldn't load the products.");
  });
});
