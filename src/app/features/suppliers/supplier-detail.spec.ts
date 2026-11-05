import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Clipboard } from '@angular/cdk/clipboard';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SupplierDetailPage } from './supplier-detail';
import { SuppliersApi } from '../../core/api/suppliers-api';
import { IngredientsApi } from '../../core/api/ingredients-api';
import { SupplierDetail } from '../../core/models/catalogue';
import { UploadRequestsApi } from '../../core/api/upload-requests-api';
import { UploadRequestItem } from '../../core/models/upload-requests';
import { LiveChanges } from '../../core/live/live-changes';
import { settle } from '../../../testing/settle';

const ACME: SupplierDetail = { id: 5, name: 'Acme Gelatin', contact_email: 'q@acme.test', country: { code: 'GB', name: 'United Kingdom' }, ingredients: [{ id: 3, name: 'Gelatin' }],
  certificates: [{ id: 11, status: 'approved', body: null, body_name_other: 'Midlands Halal Board', supplier: { id: 5, name: 'Acme Gelatin' }, certificate_number: 'MHB-1', issued_on: null, expires_on: '2027-03-12', ingredients_count: 1 }] };

const REQUESTS: UploadRequestItem[] = [
  { id: 2, status: 'open', closed_reason: null, ingredients: [{ id: 3, name: 'Gelatin' }], note: null, expires_at: '2026-10-13T10:00:00+00:00', emailed_to_saved_address: true, email: { status: 'sent', to: 'q@acme.test', at: '2026-09-29T10:05:00Z' }, can_copy_link: true, uploads_count: 1, max_uploads: 5, created_at: '2026-09-29T10:00:00+00:00', requested_by: { id: 1, name: 'Aisha' } },
  { id: 1, status: 'closed', closed_reason: 'replaced', ingredients: [{ id: 3, name: 'Gelatin' }], note: null, expires_at: '2026-10-10T10:00:00+00:00', emailed_to_saved_address: false, email: { status: 'failed', to: 'q@acme.test', at: '2026-09-26T10:05:00Z' }, can_copy_link: false, uploads_count: 0, max_uploads: 5, created_at: '2026-09-26T10:00:00+00:00', requested_by: null },
];

function setup(api: Record<string, unknown> = {}, uploadsOverrides: Record<string, unknown> = {}) {
  const uploads = { list: vi.fn(() => of(REQUESTS)), cancel: vi.fn(() => of(undefined)), link: vi.fn(() => of('https://globalhalalmarket.test/upload/abc')), ...uploadsOverrides };
  const clipboard = { copy: vi.fn(() => true) };
  const suppliers = { get: vi.fn(() => of(ACME)), linkIngredient: vi.fn(() => of(ACME)), unlinkIngredient: vi.fn(() => of(undefined)), remove: vi.fn(() => of(undefined)), ...api };
  const snackBar = { open: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: SuppliersApi, useValue: suppliers },
      { provide: IngredientsApi, useValue: { search: vi.fn(() => of([])) } },
      { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(true) })) } },
      { provide: MatSnackBar, useValue: snackBar },
      { provide: UploadRequestsApi, useValue: uploads },
      { provide: Clipboard, useValue: clipboard },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(SupplierDetailPage);
  fixture.componentRef.setInput('id', '5');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const page = fixture.componentInstance as unknown as Record<string, any>;
  return { fixture, page, suppliers, snackBar, navigate, uploads, el: fixture.nativeElement as HTMLElement };
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

  it('lists the supplier certificates and adds one with the supplier pre-filled', async () => {
    const { fixture, page, el } = setup();
    const dialog = TestBed.inject(MatDialog) as unknown as { open: ReturnType<typeof vi.fn> };
    await settle(fixture);
    const card = el.querySelector('[data-test="supplier-certificates"]') as HTMLElement;
    expect(card.textContent).toContain('Midlands Halal Board');
    expect(card.textContent).toContain('12 Mar 2027');
    expect((card.querySelector('a') as HTMLAnchorElement).getAttribute('href')).toContain('/certificates/11');
    await page['addCertificate']();
    const options = (dialog.open.mock.calls.at(-1) as unknown[])[1] as { data: { supplier: { id: number } } };
    expect(options.data.supplier).toEqual({ id: 5, name: 'Acme Gelatin' });
  });

  it('refreshes the supplier and its requests by itself when the company data changes, without a skeleton', async () => {
    const { fixture, suppliers, uploads, el } = setup();
    await settle(fixture);
    expect(suppliers.get).toHaveBeenCalledTimes(1);

    // 5 Nov 2026: e.g. the supplier uploaded a certificate in another window.
    (TestBed.inject(LiveChanges) as unknown as { changes: { next(): void } }).changes.next();
    fixture.detectChanges();
    expect(el.querySelector('hs-skeleton')).toBeNull(); // the page stays on screen
    await settle(fixture);

    expect(suppliers.get).toHaveBeenCalledTimes(2);
    expect(uploads.list).toHaveBeenCalledTimes(2);
  });

  it('lists upload links with their state and cancels an open one', async () => {
    const { fixture, page, uploads, snackBar, el } = setup();
    await settle(fixture);
    expect(el.querySelector('[data-test="upload-links"]')).toBeNull(); // 4 Nov 2026: no separate card
    const card = el.querySelector('[data-test="supplier-certificates"] [data-test="upload-requests"]') as HTMLElement;
    expect(card.textContent).toContain('Link active: waiting for the supplier');
    expect(card.querySelector('[data-test="email-2"]')?.textContent).toContain('Emailed to q@acme.test · 29 Sep 2026');
    expect(card.querySelector('[data-test="email-1"]')?.textContent).toContain('Email to q@acme.test failed');
    expect(card.textContent).toContain('By Aisha');
    expect(card.textContent).toContain('1 of 5 uploaded');
    expect(card.textContent).toContain('Replaced by a newer link');
    expect(card.textContent).toContain('13 Oct 2026');
    expect(card.querySelector('[data-test="copy-2"]')).not.toBeNull(); // open + copyable
    expect(card.querySelector('[data-test="copy-1"]')).toBeNull(); // closed
    await page['copyLink'](REQUESTS[0]);
    expect(uploads.link).toHaveBeenCalledWith(2);
    expect(snackBar.open).toHaveBeenCalledWith('Link copied. Share it only with the supplier.', 'Close', { duration: 4000 });
    await page['cancelLink'](REQUESTS[0]);
    expect(uploads.cancel).toHaveBeenCalledWith(2);
    expect(snackBar.open).toHaveBeenCalledWith('Upload link cancelled.', 'Close', { duration: 4000 });
    expect(uploads.list).toHaveBeenCalledTimes(2);
  });

  it('opens the request dialog for the supplier and reloads the links afterwards', async () => {
    const { fixture, page, uploads } = setup();
    const dialog = TestBed.inject(MatDialog) as unknown as { open: ReturnType<typeof vi.fn> };
    await settle(fixture);
    await page['requestCertificates']();
    const options = (dialog.open.mock.calls.at(-1) as unknown[])[1] as { data: { supplier: { id: number } } };
    expect(options.data.supplier.id).toBe(5);
    expect((options.data as unknown as { hasOpenLink: boolean }).hasOpenLink).toBe(true);
    expect(uploads.list).toHaveBeenCalledTimes(2);
  });

  it('asks to link ingredients before requesting certificates', async () => {
    const { fixture, el } = setup({ get: vi.fn(() => of({ ...ACME, ingredients: [] })) });
    await settle(fixture);
    (el.querySelector('[data-test="add-supplier-certificate"]') as HTMLButtonElement).click();
    await settle(fixture);
    const button = document.querySelector('[data-test="request-certificates"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Link ingredients to this supplier first');
    expect((document.querySelector('[data-test="add-manually"]') as HTMLButtonElement).disabled).toBe(false);
  });
});
