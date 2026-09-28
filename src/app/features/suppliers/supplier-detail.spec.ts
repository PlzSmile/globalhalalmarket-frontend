import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SupplierDetailPage } from './supplier-detail';
import { SuppliersApi } from '../../core/api/suppliers-api';
import { IngredientsApi } from '../../core/api/ingredients-api';
import { SupplierDetail } from '../../core/models/catalogue';
import { settle } from '../../../testing/settle';

const ACME: SupplierDetail = { id: 5, name: 'Acme Gelatin', contact_email: 'q@acme.test', country: { code: 'GB', name: 'United Kingdom' }, ingredients: [{ id: 3, name: 'Gelatin' }] };

function setup(api: Record<string, unknown> = {}) {
  const suppliers = { get: vi.fn(() => of(ACME)), linkIngredient: vi.fn(() => of(ACME)), unlinkIngredient: vi.fn(() => of(undefined)), remove: vi.fn(() => of(undefined)), ...api };
  const snackBar = { open: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: SuppliersApi, useValue: suppliers },
      { provide: IngredientsApi, useValue: { search: vi.fn(() => of([])) } },
      { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(true) })) } },
      { provide: MatSnackBar, useValue: snackBar },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(SupplierDetailPage);
  fixture.componentRef.setInput('id', '5');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const page = fixture.componentInstance as unknown as Record<string, any>;
  return { fixture, page, suppliers, snackBar, navigate, el: fixture.nativeElement as HTMLElement };
}

describe('SupplierDetailPage', () => {
  it('shows details with a mailto link and the ingredients it supplies', async () => {
    const { fixture, el } = setup();
    await settle(fixture);
    expect(el.querySelector('h1')?.textContent).toContain('Acme Gelatin');
    expect((el.querySelector('[data-test="mailto"]') as HTMLAnchorElement).getAttribute('href')).toBe('mailto:q%40acme.test');
    expect(el.textContent).toContain('Gelatin');
  });

  it('links and unlinks ingredients', async () => {
    const { fixture, page, suppliers } = setup();
    await settle(fixture);
    await page['linkIngredient']({ name: 'Sugar' });
    expect(suppliers.linkIngredient).toHaveBeenCalledWith(5, { name: 'Sugar' });
    await page['unlinkIngredient']({ id: 3, name: 'Gelatin' });
    expect(suppliers.unlinkIngredient).toHaveBeenCalledWith(5, 3);
  });

  it('deletes after confirming and goes back to the list', async () => {
    const { fixture, page, suppliers, navigate, snackBar } = setup();
    await settle(fixture);
    await page['deleteSupplier']();
    expect(suppliers.remove).toHaveBeenCalledWith(5);
    expect(navigate).toHaveBeenCalledWith(['/suppliers']);
    expect(snackBar.open).toHaveBeenCalledWith('Supplier deleted.', 'Close', { duration: 4000 });
  });

  it('keeps the supplier when only a linked ingredient was removed meanwhile', async () => {
    const { fixture, page, el, snackBar, suppliers } = setup({ unlinkIngredient: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))) });
    await settle(fixture);
    await page['unlinkIngredient']({ id: 3, name: 'Gelatin' });
    fixture.detectChanges();
    expect(suppliers.get).toHaveBeenCalledTimes(2);
    expect(el.textContent).not.toContain('Supplier not found');
    expect(snackBar.open).toHaveBeenCalledWith('Someone else changed this just now. The page is up to date again.', 'Close', { duration: 6000 });
  });

  it('builds a mailto link that cannot add hidden recipients', async () => {
    const { fixture, el } = setup({ get: vi.fn(() => of({ ...ACME, contact_email: 'a?bcc=x@evil.test&z=@acme.test' })) });
    await settle(fixture);
    expect((el.querySelector('[data-test="mailto"]') as HTMLAnchorElement).getAttribute('href'))
      .toBe('mailto:' + encodeURIComponent('a?bcc=x@evil.test&z=@acme.test'));
  });

  it('shows not found', async () => {
    const { fixture, el } = setup({ get: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))) });
    await settle(fixture);
    expect(el.textContent).toContain('Supplier not found');
  });
});
