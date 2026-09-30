import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Clipboard } from '@angular/cdk/clipboard';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { UploadRequestDialog } from './upload-request-dialog';
import { UploadRequestsApi } from '../../core/api/upload-requests-api';
import { SupplierDetail } from '../../core/models/catalogue';
import { settle } from '../../../testing/settle';

const ACME: SupplierDetail = { id: 5, name: 'Acme Gelatin', contact_email: 'q@acme.test', country: null,
  ingredients: [{ id: 1, name: 'Gelatin' }, { id: 2, name: 'Salt' }], certificates: [] };
const SENT = { id: 9, status: 'open', closed_reason: null, ingredients: [{ id: 1, name: 'Gelatin' }], note: null, expires_at: '2026-10-13T10:00:00+00:00',
  emailed_to_saved_address: true, uploads_count: 0, max_uploads: 5, created_at: null, requested_by: null, link: 'https://halalsecure.test/upload/abc' };

function setup(supplier: SupplierDetail = ACME, send = vi.fn(() => of(SENT)), hasOpenLink = false) {
  const snackBar = { open: vi.fn() };
  const clipboard = { copy: vi.fn(() => true) };
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { supplier, hasOpenLink } },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: UploadRequestsApi, useValue: { send } },
      { provide: MatSnackBar, useValue: snackBar },
      { provide: Clipboard, useValue: clipboard },
    ],
  });
  const fixture = TestBed.createComponent(UploadRequestDialog);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dialog = fixture.componentInstance as unknown as Record<string, any>;
  return { fixture, dialog, send, snackBar, clipboard, el: fixture.nativeElement as HTMLElement };
}

describe('UploadRequestDialog', () => {
  it('sends the ticked ingredients, the tidied note and the email choice, then shows the link once', async () => {
    const { fixture, dialog, send, snackBar, el } = setup();
    await settle(fixture);
    expect(el.textContent).toContain('Email the link to q@acme.test');
    dialog['toggle'](2, false);
    dialog['note'].setValue('  Please   send the 2026 one ');
    await dialog['submit']();
    await settle(fixture);

    expect(send).toHaveBeenCalledWith(5, { ingredient_ids: [1], note: 'Please send the 2026 one', send_email: true });
    expect(snackBar.open).toHaveBeenCalledWith('Upload link sent.', 'Close', { duration: 4000 });
    expect((el.querySelector('[data-test="link"]') as HTMLInputElement).value).toBe('https://halalsecure.test/upload/abc');
    expect(el.textContent).toContain('Sent by email to q@acme.test.');
    expect(el.textContent).toContain('Anyone with this link can upload certificates for this supplier until it closes. Share it only with the supplier.');
  });

  it('copies the link', async () => {
    const { fixture, dialog, clipboard, snackBar } = setup();
    await settle(fixture);
    await dialog['submit']();
    await settle(fixture);
    dialog['copy']();
    expect(clipboard.copy).toHaveBeenCalledWith('https://halalsecure.test/upload/abc');
    expect(snackBar.open).toHaveBeenLastCalledWith('Link copied.', 'Close', { duration: 3000 });
  });

  it('offers copy-link only when the supplier has no email', async () => {
    const send = vi.fn(() => of({ ...SENT, emailed_to_saved_address: false }));
    const { fixture, dialog, el } = setup({ ...ACME, contact_email: null }, send);
    await settle(fixture);
    expect(el.querySelector('[data-test="no-email"]')?.textContent).toContain('No email saved — you can copy the link and send it yourself.');
    await dialog['submit']();
    await settle(fixture);
    expect(send).toHaveBeenCalledWith(5, { ingredient_ids: [1, 2], note: null, send_email: false });
    expect(el.textContent).toContain('Not emailed.');
  });

  it('needs at least one ingredient and shows server messages', async () => {
    const error = new HttpErrorResponse({ status: 422, error: { errors: { send_email: ['This supplier has no email address. Add one on the supplier page, or send the link yourself.'] } } });
    const { fixture, dialog, send, el } = setup(ACME, vi.fn(() => throwError(() => error)));
    await settle(fixture);
    dialog['toggle'](1, false);
    dialog['toggle'](2, false);
    await dialog['submit']();
    fixture.detectChanges();
    expect(el.textContent).toContain('Choose at least one ingredient.');
    expect(send).not.toHaveBeenCalled();

    dialog['toggle'](1, true);
    await dialog['submit']();
    fixture.detectChanges();
    expect(el.textContent).toContain('This supplier has no email address.');
  });

  it('says when the email could not be sent', async () => {
    const { fixture, dialog, el } = setup(ACME, vi.fn(() => of({ ...SENT, emailed_to_saved_address: false })));
    await settle(fixture);
    await dialog['submit']();
    await settle(fixture);
    expect(el.textContent).toContain('The email could not be sent — copy the link and send it yourself.');
  });

  it('warns that a new link replaces the open one', async () => {
    const { fixture, el } = setup(ACME, vi.fn(() => of(SENT)), true);
    await settle(fixture);
    expect(el.querySelector('[data-test="replaces"]')?.textContent).toContain('Sending a new link stops the open link for this supplier.');
  });
});
