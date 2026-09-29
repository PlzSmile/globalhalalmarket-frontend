import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProductsList } from './products-list';
import { ProductsApi } from '../../core/api/products-api';
import { Paginated, ProductListItem } from '../../core/models/catalogue';
import { AuthService } from '../../core/auth/auth.service';
import { settle } from '../../../testing/settle';

let canManage = true;

function page(items: readonly ProductListItem[], total = items.length): Paginated<ProductListItem> {
  return { data: items, meta: { current_page: 1, last_page: Math.max(1, Math.ceil(total / 25)), per_page: 25, total } };
}

const SAUSAGE: ProductListItem = { id: 7, name: 'Chicken sausage', sku: 'CS-500', ingredients_count: 3 };

function setup(list: ReturnType<typeof vi.fn>, query: Record<string, string> = {}, dialogResult: unknown = undefined) {
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ProductsApi, useValue: { list } },
      { provide: AuthService, useValue: { canManageTeam: () => canManage } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      { provide: MatDialog, useValue: dialog },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ProductsList);
  return { fixture, dialog, navigate, el: fixture.nativeElement as HTMLElement };
}

describe('ProductsList', () => {
  beforeEach(() => {
    canManage = true;
  });

  it('loads the search and page from the URL and links each product', async () => {
    const list = vi.fn(() => of(page([SAUSAGE])));
    const { fixture, el } = setup(list, { search: 'sau', page: '2' });
    await settle(fixture);
    expect(list).toHaveBeenCalledWith('sau', 2);
    const link = el.querySelector('[data-test="product-link"]') as HTMLAnchorElement;
    expect(link.textContent).toContain('Chicken sausage');
    expect(link.getAttribute('href')).toContain('/products/7');
    expect(el.textContent).toContain('CS-500');
  });

  it('shows the empty state for a new company and a no-match message for a search', async () => {
    const empty = setup(vi.fn(() => of(page([]))));
    await settle(empty.fixture);
    expect(empty.el.textContent).toContain('Add your first product');
    TestBed.resetTestingModule();
    const noMatch = setup(vi.fn(() => of(page([]))), { search: 'zzz' });
    await settle(noMatch.fixture);
    expect(noMatch.el.textContent).toContain('No products match "zzz".');
  });

  it('shows an error with Try again', async () => {
    const list = vi.fn().mockReturnValueOnce(throwError(() => new Error('down'))).mockReturnValue(of(page([SAUSAGE])));
    const { fixture, el } = setup(list);
    await settle(fixture);
    expect(el.textContent).toContain("We couldn't load your products.");
    (el.querySelector('[data-test="retry"]') as HTMLButtonElement).click();
    await settle(fixture);
    expect(list).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('Chicken sausage');
  });

  it('searches 300 ms after typing, from page 1, and keeps it in the URL', async () => {
    const list = vi.fn(() => of(page([SAUSAGE])));
    const { fixture, navigate } = setup(list, { page: '3' });
    await settle(fixture);
    vi.useFakeTimers();
    fixture.componentInstance['search'].setValue('  beef ');
    vi.advanceTimersByTime(300);
    vi.useRealTimers();
    await settle(fixture);
    expect(list).toHaveBeenLastCalledWith('beef', 1);
    expect(navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: { search: 'beef', page: null }, replaceUrl: true }));
  });

  it('ignores a slow older reply that arrives after a newer one', async () => {
    const older = new Subject<Paginated<ProductListItem>>();
    const newer = new Subject<Paginated<ProductListItem>>();
    const list = vi.fn().mockReturnValueOnce(of(page([]))).mockReturnValueOnce(older.asObservable()).mockReturnValueOnce(newer.asObservable());
    const { fixture, el } = setup(list);
    await settle(fixture);
    fixture.componentInstance['onPage']({ pageIndex: 1, pageSize: 25, length: 60 });
    fixture.componentInstance['onPage']({ pageIndex: 2, pageSize: 25, length: 60 });
    newer.next(page([{ id: 3, name: 'Page three product', sku: null, ingredients_count: 0 }]));
    newer.complete();
    older.next(page([{ id: 2, name: 'Page two product', sku: null, ingredients_count: 0 }]));
    older.complete();
    await settle(fixture);
    expect(el.textContent).toContain('Page three product');
    expect(el.textContent).not.toContain('Page two product');
  });

  it('changes page', async () => {
    const list = vi.fn(() => of(page([SAUSAGE], 60)));
    const { fixture } = setup(list);
    await settle(fixture);
    fixture.componentInstance['onPage']({ pageIndex: 1, pageSize: 25, length: 60 });
    await settle(fixture);
    expect(list).toHaveBeenLastCalledWith('', 2);
  });

  it('opens the new product after adding it', async () => {
    const { fixture, dialog, navigate } = setup(vi.fn(() => of(page([]))), {}, { id: 9, name: 'New', sku: null, ingredients: [] });
    await settle(fixture);
    await fixture.componentInstance['add']();
    expect(dialog.open).toHaveBeenCalled();
    expect(navigate).toHaveBeenLastCalledWith(['/products', 9]);
  });

  it('shows "Import CSV" to owners and admins only', async () => {
    const shown = setup(vi.fn(() => of(page([SAUSAGE]))));
    await settle(shown.fixture);
    expect(shown.el.querySelector('[data-test="import-csv"]')?.getAttribute('href')).toContain('/import');

    TestBed.resetTestingModule();
    canManage = false;
    const hidden = setup(vi.fn(() => of(page([SAUSAGE]))));
    await settle(hidden.fixture);
    expect(hidden.el.querySelector('[data-test="import-csv"]')).toBeNull();
  });
});
