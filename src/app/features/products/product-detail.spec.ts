import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProductDetailPage } from './product-detail';
import { ProductsApi } from '../../core/api/products-api';
import { IngredientsApi } from '../../core/api/ingredients-api';
import { SuppliersApi } from '../../core/api/suppliers-api';
import { ProductDetail } from '../../core/models/catalogue';
import { settle } from '../../../testing/settle';

const PRODUCT: ProductDetail = {
  id: 7, name: 'Chicken sausage', sku: 'CS-500',
  ingredients: [{ id: 3, name: 'Gelatin', products_count: 2, suppliers: [{ id: 5, name: 'Acme Gelatin' }] }],
};
const NOT_FOUND = new HttpErrorResponse({ status: 404 });

function setup(overrides: { products?: Record<string, unknown>; ingredients?: Record<string, unknown>; confirm?: unknown } = {}) {
  const products = { get: vi.fn(() => of(PRODUCT)), linkIngredient: vi.fn(() => of(PRODUCT)), unlinkIngredient: vi.fn(() => of(undefined)), remove: vi.fn(() => of(undefined)), ...overrides.products };
  const ingredients = { remove: vi.fn(() => of({ unlinked_products: 2, unlinked_suppliers: 1 })), linkSupplier: vi.fn(() => of({})), unlinkSupplier: vi.fn(() => of(undefined)), rename: vi.fn(() => of({})), search: vi.fn(() => of([])), ...overrides.ingredients };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(overrides.confirm ?? true) })) };
  const snackBar = { open: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ProductsApi, useValue: products },
      { provide: IngredientsApi, useValue: ingredients },
      { provide: SuppliersApi, useValue: { search: vi.fn(() => of([])) } },
      { provide: MatDialog, useValue: dialog },
      { provide: MatSnackBar, useValue: snackBar },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ProductDetailPage);
  fixture.componentRef.setInput('id', '7');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const page = fixture.componentInstance as unknown as Record<string, any>;
  return { fixture, page, products, ingredients, dialog, snackBar, navigate, el: fixture.nativeElement as HTMLElement };
}

describe('ProductDetailPage', () => {
  it('shows the product, its ingredients and their suppliers', async () => {
    const { fixture, products, el } = setup();
    await settle(fixture);
    expect(products.get).toHaveBeenCalledWith(7);
    expect(el.querySelector('h1')?.textContent).toContain('Chicken sausage');
    expect(el.textContent).toContain('CS-500');
    expect(el.textContent).toContain('Gelatin');
    expect(el.textContent).toContain('Acme Gelatin');
  });

  it('links an ingredient picked or created in the picker', async () => {
    const { fixture, page, products, snackBar } = setup();
    await settle(fixture);
    await page['linkIngredient']({ name: 'Cocoa butter' });
    expect(products.linkIngredient).toHaveBeenCalledWith(7, { name: 'Cocoa butter' });
    expect(snackBar.open).toHaveBeenCalledWith('Cocoa butter added.', 'Close', { duration: 4000 });
  });

  it('unlinks a supplier from an ingredient and reloads', async () => {
    const { fixture, page, ingredients, products } = setup();
    await settle(fixture);
    await page['unlinkSupplier'](PRODUCT.ingredients[0], PRODUCT.ingredients[0].suppliers[0]);
    expect(ingredients.unlinkSupplier).toHaveBeenCalledWith(3, 5);
    expect(products.get).toHaveBeenCalledTimes(2);
  });

  it('confirms with the product count before deleting an ingredient everywhere', async () => {
    const { fixture, page, dialog, ingredients } = setup();
    await settle(fixture);
    await page['deleteIngredient'](PRODUCT.ingredients[0]);
    const data = (dialog.open.mock.calls[0] as unknown[])[1] as { data: { message: string } };
    expect(data.data.message).toContain('used in 2 products');
    expect(ingredients.remove).toHaveBeenCalledWith(3);
  });

  it('does not delete when the confirm is cancelled', async () => {
    const { fixture, page, ingredients } = setup({ confirm: false });
    await settle(fixture);
    await page['deleteIngredient'](PRODUCT.ingredients[0]);
    expect(ingredients.remove).not.toHaveBeenCalled();
  });

  it('deletes the product and goes back to the list', async () => {
    const { fixture, page, products, navigate, snackBar } = setup();
    await settle(fixture);
    await page['deleteProduct']();
    expect(products.remove).toHaveBeenCalledWith(7);
    expect(navigate).toHaveBeenCalledWith(['/products']);
    expect(snackBar.open).toHaveBeenCalledWith('Product deleted.', 'Close', { duration: 4000 });
  });

  it('shows not found for a missing product', async () => {
    const { fixture, el } = setup({ products: { get: vi.fn(() => throwError(() => NOT_FOUND)) } });
    await settle(fixture);
    expect(el.textContent).toContain('Product not found');
  });

  it('shows not found when an action returns 404 because the product itself was deleted', async () => {
    const get = vi.fn().mockReturnValueOnce(of(PRODUCT)).mockReturnValue(throwError(() => NOT_FOUND));
    const { fixture, page, el } = setup({ products: { get, linkIngredient: vi.fn(() => throwError(() => NOT_FOUND)) } });
    await settle(fixture);
    await page['linkIngredient']({ id: 9 });
    fixture.detectChanges();
    expect(el.textContent).toContain('Product not found');
  });

  it('keeps the product and explains when only a linked record was removed meanwhile', async () => {
    const { fixture, page, el, snackBar, products } = setup({ ingredients: { unlinkSupplier: vi.fn(() => throwError(() => NOT_FOUND)) } });
    await settle(fixture);
    await page['unlinkSupplier'](PRODUCT.ingredients[0], PRODUCT.ingredients[0].suppliers[0]);
    fixture.detectChanges();
    expect(products.get).toHaveBeenCalledTimes(2);
    expect(el.textContent).not.toContain('Product not found');
    expect(el.querySelector('h1')?.textContent).toContain('Chicken sausage');
    expect(snackBar.open).toHaveBeenCalledWith('Someone else changed this just now. The page is up to date again.', 'Close', { duration: 6000 });
  });

  it('shows the server message and ignores clicks while busy', async () => {
    const error = new HttpErrorResponse({ status: 422, error: { errors: { name: ['Choose an ingredient from your list.'] } } });
    const { fixture, page, products, snackBar } = setup({ products: { linkIngredient: vi.fn(() => throwError(() => error)) } });
    await settle(fixture);
    await page['linkIngredient']({ id: 9 });
    expect(snackBar.open).toHaveBeenCalledWith('Choose an ingredient from your list.', 'Close', { duration: 6000 });
    page['busy'].set(true);
    await page['linkIngredient']({ id: 9 });
    expect(products.linkIngredient).toHaveBeenCalledTimes(1);
  });

  it('shows each ingredient certificate status as information', async () => {
    const product: ProductDetail = { ...PRODUCT, ingredients: [
      { ...PRODUCT.ingredients[0], certificate: { id: 11, status: 'approved', expires_on: '2099-03-12' } },
      { id: 4, name: 'Pepper', products_count: 1, suppliers: [], certificate: { id: 12, status: 'approved', expires_on: '2020-01-05' } },
      { id: 5, name: 'Sugar', products_count: 1, suppliers: [], certificate: null },
    ] };
    const { fixture, el } = setup({ products: { get: vi.fn(() => of(product)) } });
    await settle(fixture);
    expect(el.querySelector('[data-test="cert-3"]')?.textContent).toContain('Certified until 12 Mar 2099');
    expect(el.querySelector('[data-test="cert-4"]')?.textContent).toContain('Certificate expired on 5 Jan 2020');
    expect(el.querySelector('[data-test="cert-5"]')?.textContent).toContain('No approved certificate');
  });
});
