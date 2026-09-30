import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CertificatesList } from './certificates-list';
import { CertificatesApi } from '../../core/api/certificates-api';
import { Paginated } from '../../core/models/catalogue';
import { CertificateListItem } from '../../core/models/certificates';
import { settle } from '../../../testing/settle';

const ITEM: CertificateListItem = { id: 1, status: 'pending', body: null, body_name_other: 'Midlands Halal Board', supplier: { id: 5, name: 'Acme Gelatin' },
  certificate_number: 'MHB-1', issued_on: null, expires_on: '2020-01-01', ingredients_count: 2 };
const page = (items: readonly CertificateListItem[]): Paginated<CertificateListItem> =>
  ({ data: items, meta: { current_page: 1, last_page: 1, per_page: 25, total: items.length } });

function setup(list: ReturnType<typeof vi.fn>, query: Record<string, string> = {}, dialogResult: unknown = undefined) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CertificatesApi, useValue: { list } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) } },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(CertificatesList);
  return { fixture, navigate, el: fixture.nativeElement as HTMLElement };
}

describe('CertificatesList', () => {
  it('reads filters from the URL and shows rows with body, supplier, expiry note and status', async () => {
    const list = vi.fn(() => of(page([ITEM])));
    const { fixture, el } = setup(list, { status: 'pending', expiring: '1', search: 'mid', page: '2' });
    await settle(fixture);
    expect(list).toHaveBeenCalledWith({ search: 'mid', status: 'pending', supplierId: null, expiring: true, archived: false, page: 2 });
    expect((el.querySelector('[data-test="certificate-link"]') as HTMLAnchorElement).getAttribute('href')).toContain('/certificates/1');
    expect(el.textContent).toContain('Midlands Halal Board');
    expect(el.textContent).toContain('Acme Gelatin');
    expect(el.textContent).toContain('1 Jan 2020');
    expect(el.textContent).toContain('Expired');
    expect(el.textContent).toContain('Pending review');
  });

  it('changes the status filter from page 1 and keeps it in the URL', async () => {
    const list = vi.fn(() => of(page([ITEM])));
    const { fixture, navigate } = setup(list, { page: '3' });
    await settle(fixture);
    fixture.componentInstance['setFilter']('rejected');
    await settle(fixture);
    expect(list).toHaveBeenLastCalledWith({ search: '', status: 'rejected', supplierId: null, expiring: false, archived: false, page: 1 });
    expect(navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: { search: null, status: 'rejected', expiring: null, page: null } }));
    fixture.componentInstance['setFilter']('expiring');
    await settle(fixture);
    expect(list).toHaveBeenLastCalledWith({ search: '', status: null, supplierId: null, expiring: true, archived: false, page: 1 });
  });

  it('shows empty, error and no-match states', async () => {
    const empty = setup(vi.fn(() => of(page([]))));
    await settle(empty.fixture);
    expect(empty.el.textContent).toContain('Add your first certificate');
    TestBed.resetTestingModule();
    const failed = setup(vi.fn(() => throwError(() => new Error('down'))));
    await settle(failed.fixture);
    expect(failed.el.textContent).toContain("We couldn't load your certificates.");
    TestBed.resetTestingModule();
    const noMatch = setup(vi.fn(() => of(page([]))), { search: 'zzz' });
    await settle(noMatch.fixture);
    expect(noMatch.el.textContent).toContain('No certificates match');
  });

  it('ignores a slow older reply that arrives after a newer one', async () => {
    const older = new Subject<Paginated<CertificateListItem>>();
    const newer = new Subject<Paginated<CertificateListItem>>();
    const list = vi.fn().mockReturnValueOnce(of(page([]))).mockReturnValueOnce(older.asObservable()).mockReturnValueOnce(newer.asObservable());
    const { fixture, el } = setup(list);
    await settle(fixture);
    fixture.componentInstance['setFilter']('approved');
    fixture.componentInstance['setFilter']('pending');
    newer.next(page([{ ...ITEM, id: 2, certificate_number: 'NEWER' }]));
    newer.complete();
    older.next(page([{ ...ITEM, id: 3, certificate_number: 'OLDER' }]));
    older.complete();
    await settle(fixture);
    expect(el.textContent).toContain('NEWER');
    expect(el.textContent).not.toContain('OLDER');
  });

  it('opens the new certificate after adding it', async () => {
    const { fixture, navigate } = setup(vi.fn(() => of(page([]))), {}, { id: 7 });
    await settle(fixture);
    await fixture.componentInstance['add']();
    expect(navigate).toHaveBeenLastCalledWith(['/certificates', 7]);
  });

  it('names the expiry filter honestly and keeps card labels in the normal font', async () => {
    const { fixture, el } = setup(vi.fn(() => of(page([ITEM]))));
    await settle(fixture);
    expect(el.textContent).toContain('Expired or expiring within 60 days');
    const numberCell = el.querySelector('td[data-label="Number"]') as HTMLElement;
    expect(numberCell.classList.contains('mono')).toBe(false);
    expect(numberCell.querySelector('.mono')?.textContent).toContain('MHB-1');
  });
});
