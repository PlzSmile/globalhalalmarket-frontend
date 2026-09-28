import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SupplierDialog, SupplierDialogData } from './supplier-dialog';
import { SuppliersApi } from '../../core/api/suppliers-api';
import { CountriesApi } from '../../core/api/countries-api';

const GB = { code: 'GB', name: 'United Kingdom' };
const SAVED = { id: 5, name: 'Acme', contact_email: 'q@acme.test', country: GB, ingredients: [] };

function setup(data: SupplierDialogData, api: Record<string, unknown>) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
      { provide: SuppliersApi, useValue: api },
      { provide: CountriesApi, useValue: { list: () => of([GB, { code: 'MY', name: 'Malaysia' }]) } },
    ],
  });
  const fixture = TestBed.createComponent(SupplierDialog);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { fixture, close, dialog: fixture.componentInstance as unknown as Record<string, any>, el: fixture.nativeElement as HTMLElement };
}

describe('SupplierDialog', () => {
  it('creates with a chosen country code and a blank email as null', async () => {
    const create = vi.fn(() => of(SAVED));
    const { close, dialog } = setup({ supplier: null }, { create });
    dialog['form'].setValue({ name: ' Acme ', contact_email: ' ', country: GB });
    await dialog['save']();
    expect(create).toHaveBeenCalledWith({ name: 'Acme', contact_email: null, country_code: 'GB' });
    expect(close).toHaveBeenCalledWith(SAVED);
  });

  it('filters countries by the typed text', () => {
    const { dialog } = setup({ supplier: null }, {});
    dialog['form'].controls.country.setValue('mal');
    expect(dialog['filteredCountries']()).toEqual([{ code: 'MY', name: 'Malaysia' }]);
  });

  it('refuses a typed country that was not picked from the list', async () => {
    const create = vi.fn(() => of(SAVED));
    const { fixture, dialog, el } = setup({ supplier: null }, { create });
    dialog['form'].setValue({ name: 'Acme', contact_email: '', country: 'Narnia' });
    await dialog['save']();
    fixture.detectChanges();
    expect(create).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Choose a country from the list.');
  });

  it('edits with the current values and shows a duplicate name from the server', async () => {
    const error = new HttpErrorResponse({ status: 422, error: { errors: { name: ['You already have a supplier called Zed.'] } } });
    const update = vi.fn(() => throwError(() => error));
    const { fixture, dialog, el } = setup({ supplier: SAVED }, { update });
    expect(dialog['form'].getRawValue()).toEqual({ name: 'Acme', contact_email: 'q@acme.test', country: GB });
    dialog['form'].controls.name.setValue('Zed');
    await dialog['save']();
    fixture.detectChanges();
    expect(update).toHaveBeenCalledWith(5, { name: 'Zed', contact_email: 'q@acme.test', country_code: 'GB' });
    expect(el.textContent).toContain('You already have a supplier called Zed.');
  });
});
