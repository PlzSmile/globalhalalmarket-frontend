import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProductDialog, ProductDialogData } from './product-dialog';
import { ProductsApi } from '../../core/api/products-api';

const SAVED = { id: 7, name: 'Chicken sausage', sku: 'CS-500', ingredients: [] };

function setup(data: ProductDialogData, api: Partial<Record<'create' | 'update', ReturnType<typeof vi.fn>>>) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
      { provide: ProductsApi, useValue: api },
    ],
  });
  const fixture = TestBed.createComponent(ProductDialog);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { fixture, close, dialog: fixture.componentInstance as unknown as Record<string, any>, el: fixture.nativeElement as HTMLElement };
}

describe('ProductDialog', () => {
  it('creates with tidied values (blank SKU → null) and closes with the product', async () => {
    const create = vi.fn(() => of(SAVED));
    const { close, dialog } = setup({ product: null }, { create });
    dialog['form'].setValue({ name: '  Chicken   sausage ', sku: '  ' });
    await dialog['save']();
    expect(create).toHaveBeenCalledWith({ name: 'Chicken sausage', sku: null });
    expect(close).toHaveBeenCalledWith(SAVED);
  });

  it('edits an existing product', async () => {
    const update = vi.fn(() => of(SAVED));
    const { dialog } = setup({ product: { id: 7, name: 'Old', sku: 'OLD' } }, { update });
    expect(dialog['form'].getRawValue()).toEqual({ name: 'Old', sku: 'OLD' });
    dialog['form'].controls.name.setValue('New');
    await dialog['save']();
    expect(update).toHaveBeenCalledWith(7, { name: 'New', sku: 'OLD' });
  });

  it('shows a duplicate SKU under the field', async () => {
    const error = new HttpErrorResponse({ status: 422, error: { errors: { sku: ['You already have a product with this SKU.'] } } });
    const { fixture, close, dialog, el } = setup({ product: null }, { create: vi.fn(() => throwError(() => error)) });
    dialog['form'].setValue({ name: 'X', sku: 'CS-500' });
    await dialog['save']();
    fixture.detectChanges();
    expect(close).not.toHaveBeenCalled();
    expect(el.textContent).toContain('You already have a product with this SKU.');
  });

  it('requires a name and blocks a second click while saving', async () => {
    const create = vi.fn(() => of(SAVED));
    const { dialog } = setup({ product: null }, { create });
    await dialog['save']();
    expect(create).not.toHaveBeenCalled();
    dialog['form'].setValue({ name: 'A', sku: '' });
    dialog['busy'].set(true);
    await dialog['save']();
    expect(create).not.toHaveBeenCalled();
  });
});
