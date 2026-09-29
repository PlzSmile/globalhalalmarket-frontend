import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { DateAdapter } from '@angular/material/core';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CertificateDialog, CertificateDialogData } from './certificate-dialog';
import { CertificatesApi } from '../../core/api/certificates-api';
import { BodiesApi } from '../../core/api/bodies-api';
import { SuppliersApi } from '../../core/api/suppliers-api';
import { IngredientsApi } from '../../core/api/ingredients-api';
import { CertificateDetail, UploadEvent } from '../../core/models/certificates';
import { settle } from '../../../testing/settle';

const ACME = { id: 5, name: 'Acme Gelatin' };
const HMC = { id: 9, name: 'Halal Monitoring Committee', country: null };
const SAVED = { id: 1, status: 'approved', supplier: ACME, body: { id: 9, name: HMC.name }, body_name_other: null, ingredients: [{ id: 3, name: 'Gelatin' }],
  certificate_number: 'HMC-1', scope: null, issued_on: '2026-01-10', expires_on: '2027-01-09', ingredients_count: 1,
  file: { original_name: 'c.pdf', size: 100 }, reviewed_by: null, reviewed_at: null, rejection_reason: null, created_at: null, from_upload_link: false } as CertificateDetail;

function setup(data: CertificateDialogData, certificates: Record<string, unknown> = {}) {
  const close = vi.fn();
  const api = { create: vi.fn(() => of<UploadEvent[]>({ kind: 'progress', percent: 40 }, { kind: 'done', certificate: SAVED })), update: vi.fn(() => of(SAVED)), ...certificates };
  const suppliers = { search: vi.fn(() => of([ACME])), get: vi.fn(() => of({ ...ACME, contact_email: null, country: null, ingredients: [{ id: 3, name: 'Gelatin' }, { id: 4, name: 'Sugar' }] })) };
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
      { provide: CertificatesApi, useValue: api },
      { provide: BodiesApi, useValue: { search: vi.fn(() => of([HMC])) } },
      { provide: SuppliersApi, useValue: suppliers },
      { provide: IngredientsApi, useValue: { search: vi.fn(() => of([])) } },
    ],
  });
  const fixture = TestBed.createComponent(CertificateDialog);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dialog = fixture.componentInstance as unknown as Record<string, any>;
  return { fixture, dialog, api, close, suppliers, el: fixture.nativeElement as HTMLElement };
}

function fill(dialog: Record<string, any>): void {
  dialog['form'].patchValue({ supplier_id: ACME, certification_body_id: HMC, certificate_number: ' HMC-1 ', issued_on: new Date(2026, 0, 10), expires_on: new Date(2027, 0, 9) });
  dialog['toggleIngredient']({ id: 3, name: 'Gelatin' }, true);
  dialog['file'].set(new File(['%PDF-1.4'], 'c.pdf', { type: 'application/pdf' }));
}

describe('CertificateDialog', () => {
  it('uploads with the chosen supplier, catalogue body, dates and ingredients, then closes', async () => {
    const { fixture, dialog, api, close } = setup({ certificate: null });
    await settle(fixture);
    fill(dialog);
    await dialog['save']();
    expect(api.create).toHaveBeenCalledWith({
      supplier_id: 5, certification_body_id: 9, body_name_other: null, certificate_number: 'HMC-1', scope: null,
      issued_on: '2026-01-10', expires_on: '2027-01-09', ingredient_ids: [3],
    }, expect.any(File));
    expect(close).toHaveBeenCalledWith(SAVED);
  });

  it('accepts a typed body name when the body is not in the list', async () => {
    const { fixture, dialog, api } = setup({ certificate: null });
    await settle(fixture);
    fill(dialog);
    dialog['useOtherBody'].set(true);
    dialog['form'].controls.body_name_other.setValue('  Midlands   Halal Board ');
    await dialog['save']();
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ certification_body_id: null, body_name_other: 'Midlands Halal Board' }), expect.any(File));
  });

  it('needs a file, at least one ingredient and dates in order', async () => {
    const { fixture, dialog, api, el } = setup({ certificate: null });
    await settle(fixture);
    fill(dialog);
    dialog['file'].set(null);
    await dialog['save']();
    fixture.detectChanges();
    expect(el.textContent).toContain('Choose the certificate PDF.');

    fill(dialog);
    dialog['toggleIngredient']({ id: 3, name: 'Gelatin' }, false);
    await dialog['save']();
    fixture.detectChanges();
    expect(el.textContent).toContain('Choose at least one ingredient.');

    fill(dialog);
    dialog['form'].patchValue({ issued_on: new Date(2027, 5, 1) });
    await dialog['save']();
    fixture.detectChanges();
    expect(el.textContent).toContain('The expiry date must be on or after the issue date.');
    expect(api.create).not.toHaveBeenCalled();
  });

  it('pre-fills the supplier and lists its ingredients', async () => {
    const { fixture, suppliers, el } = setup({ certificate: null, supplier: ACME });
    await settle(fixture);
    expect(suppliers.get).toHaveBeenCalledWith(5);
    expect(el.textContent).toContain('Gelatin');
    expect(el.textContent).toContain('Sugar');
  });

  it('edits details without a file', async () => {
    const { fixture, dialog, api, el } = setup({ certificate: SAVED });
    await settle(fixture);
    expect(el.querySelector('hs-file-picker')).toBeNull();
    dialog['form'].controls.certificate_number.setValue('HMC-2');
    await dialog['save']();
    expect(api.update).toHaveBeenCalledWith(1, expect.objectContaining({ certificate_number: 'HMC-2', ingredient_ids: [3] }));
  });

  it('shows server problems: scanner down (503) and a refused file (422)', async () => {
    const down = new HttpErrorResponse({ status: 503, error: { message: 'Virus scanning is unavailable right now, so the file was not saved. Please try again in a few minutes.' } });
    const first = setup({ certificate: null }, { create: vi.fn(() => throwError(() => down)) });
    await settle(first.fixture);
    fill(first.dialog);
    await first.dialog['save']();
    first.fixture.detectChanges();
    expect(first.el.textContent).toContain('Virus scanning is unavailable right now');

    TestBed.resetTestingModule();
    const refused = new HttpErrorResponse({ status: 422, error: { errors: { file: ['This file failed the virus scan and was not saved.'] } } });
    const second = setup({ certificate: null }, { create: vi.fn(() => throwError(() => refused)) });
    await settle(second.fixture);
    fill(second.dialog);
    await second.dialog['save']();
    second.fixture.detectChanges();
    expect(second.el.textContent).toContain('This file failed the virus scan and was not saved.');
  });

  it('shows upload progress and ignores a second click while saving', async () => {
    const pending = new Subject<UploadEvent>();
    const { fixture, dialog, api } = setup({ certificate: null }, { create: vi.fn(() => pending.asObservable()) });
    await settle(fixture);
    fill(dialog);
    void dialog['save']();
    pending.next({ kind: 'progress', percent: 60 });
    expect(dialog['progress']()).toBe(60);
    await dialog['save']();
    expect(api.create).toHaveBeenCalledTimes(1);
    pending.next({ kind: 'done', certificate: SAVED });
    pending.complete();
  });

  it('reads typed dates day first (UK): 12/03/2027 is 12 March, not 3 December', async () => {
    const { fixture } = setup({ certificate: null });
    await settle(fixture);
    const adapter = fixture.debugElement.injector.get(DateAdapter<Date>);
    const date = adapter.parse('12/03/2027', null) as Date;
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2027, 2, 12]);
  });

  it('does not save a typed date it cannot read (no silent "no date")', async () => {
    const { fixture, dialog, api, el } = setup({ certificate: null });
    await settle(fixture);
    fill(dialog);
    const issued = el.querySelector('input[formcontrolname="issued_on"]') as HTMLInputElement;
    issued.value = '31/02/2027';
    issued.dispatchEvent(new Event('input'));
    issued.dispatchEvent(new Event('blur'));
    await dialog['save']();
    fixture.detectChanges();
    expect(api.create).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Enter the date as DD/MM/YYYY.');
  });

  it('explains when the chosen supplier has no ingredients yet', async () => {
    const { fixture, dialog, suppliers, el } = setup({ certificate: null });
    await settle(fixture);
    suppliers.get.mockReturnValue(of({ ...ACME, contact_email: null, country: null, ingredients: [] }));
    await dialog['onSupplierPicked'](ACME);
    await settle(fixture);
    expect(el.textContent).toContain('This supplier has no ingredients linked yet. Search your ingredients below.');
  });
});
