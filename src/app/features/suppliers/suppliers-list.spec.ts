import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SuppliersList } from './suppliers-list';
import { SuppliersApi } from '../../core/api/suppliers-api';
import { Paginated, SupplierListItem } from '../../core/models/catalogue';
import { settle } from '../../../testing/settle';

const ACME: SupplierListItem = { id: 5, name: 'Acme Gelatin', country: { code: 'GB', name: 'United Kingdom' }, ingredients_count: 2 };
const page = (items: readonly SupplierListItem[]): Paginated<SupplierListItem> =>
  ({ data: items, meta: { current_page: 1, last_page: 1, per_page: 25, total: items.length } });

function setup(list: ReturnType<typeof vi.fn>, query: Record<string, string> = {}, dialogResult: unknown = undefined) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: SuppliersApi, useValue: { list } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) } },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(SuppliersList);
  return { fixture, navigate, el: fixture.nativeElement as HTMLElement };
}

describe('SuppliersList', () => {
  it('lists suppliers with country and ingredient count, never an email', async () => {
    const list = vi.fn(() => of(page([ACME])));
    const { fixture, el } = setup(list, { search: 'acm' });
    await settle(fixture);
    expect(list).toHaveBeenCalledWith('acm', 1);
    expect((el.querySelector('[data-test="supplier-link"]') as HTMLAnchorElement).getAttribute('href')).toContain('/suppliers/5');
    expect(el.textContent).toContain('United Kingdom');
    expect(el.textContent).not.toContain('@');
  });

  it('shows the empty state and the error state', async () => {
    const empty = setup(vi.fn(() => of(page([]))));
    await settle(empty.fixture);
    expect(empty.el.textContent).toContain('Add your first supplier');
    TestBed.resetTestingModule();
    const failed = setup(vi.fn(() => throwError(() => new Error('down'))));
    await settle(failed.fixture);
    expect(failed.el.textContent).toContain("We couldn't load your suppliers.");
  });

  it('ignores a slow older reply that arrives after a newer one', async () => {
    const older = new Subject<Paginated<SupplierListItem>>();
    const newer = new Subject<Paginated<SupplierListItem>>();
    const list = vi.fn().mockReturnValueOnce(of(page([]))).mockReturnValueOnce(older.asObservable()).mockReturnValueOnce(newer.asObservable());
    const { fixture, el } = setup(list);
    await settle(fixture);
    fixture.componentInstance['onPage']({ pageIndex: 1, pageSize: 25, length: 60 });
    fixture.componentInstance['onPage']({ pageIndex: 2, pageSize: 25, length: 60 });
    newer.next(page([{ ...ACME, id: 9, name: 'Newer supplier' }]));
    newer.complete();
    older.next(page([{ ...ACME, id: 8, name: 'Older supplier' }]));
    older.complete();
    await settle(fixture);
    expect(el.textContent).toContain('Newer supplier');
    expect(el.textContent).not.toContain('Older supplier');
  });

  it('opens the new supplier after adding it', async () => {
    const { fixture, navigate } = setup(vi.fn(() => of(page([]))), {}, { id: 8, name: 'New', contact_email: null, country: null, ingredients: [] });
    await settle(fixture);
    await fixture.componentInstance['add']();
    expect(navigate).toHaveBeenLastCalledWith(['/suppliers', 8]);
  });
});
