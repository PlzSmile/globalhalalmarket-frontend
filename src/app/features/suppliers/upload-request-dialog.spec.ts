import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Clipboard } from '@angular/cdk/clipboard';
import { HttpErrorResponse } from '@angular/common/http';
import { MatIconRegistry } from '@angular/material/icon';
import { FakeMatIconRegistry } from '@angular/material/icon/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { UploadRequestDialog } from './upload-request-dialog';
import { UploadRequestsApi } from '../../core/api/upload-requests-api';
import { EmailTemplatesApi } from '../../core/api/email-templates-api';
import { SupplierDetail } from '../../core/models/catalogue';
import { EmailTemplate } from '../../core/models/email-templates';
import { SentUploadRequest } from '../../core/models/upload-requests';
import { settle } from '../../../testing/settle';
import { PREVIEW_DELAY_MS } from '../../shared/ui/email-composer';

const ACME: SupplierDetail = { id: 5, name: 'Acme Gelatin', contact_email: 'Q@acme.test', country: null,
  ingredients: [{ id: 1, name: 'Gelatin' }, { id: 2, name: 'Salt' }], certificates: [] };
const SENT: SentUploadRequest = { id: 9, status: 'open', closed_reason: null, ingredients: [{ id: 1, name: 'Gelatin' }], note: null, expires_at: '2026-10-13T10:00:00+00:00',
  emailed_to_saved_address: true, email: { status: 'sent', to: 'q@acme.test', at: '2026-11-04T14:32:00Z' }, can_copy_link: true, uploads_count: 0, max_uploads: 5, created_at: null, requested_by: null, link: 'https://globalhalalmarket.test/upload/abc' };
const TEMPLATE: EmailTemplate = { kind: 'upload_request', label: 'Certificate request', subject: '[Your Company] asks for your halal certificates',
  message: 'Hello [Supplier Name],\n\n[Upload Link]', is_default: true, placeholders: ['Supplier Name', 'Upload Link'] };

function setup(supplier: SupplierDetail = ACME, send = vi.fn(() => of(SENT)), hasOpenLink = false) {
  const snackBar = { open: vi.fn() };
  const clipboard = { copy: vi.fn(() => true) };
  const preview = vi.fn(() => of({ subject: 'Khan Foods asks for your halal certificates', html: '<p>Hello Acme Gelatin</p>' }));
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { supplier, hasOpenLink } },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: UploadRequestsApi, useValue: { send } },
      { provide: EmailTemplatesApi, useValue: { list: () => of([TEMPLATE]), preview } },
      { provide: MatSnackBar, useValue: snackBar },
      { provide: Clipboard, useValue: clipboard },
      { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
    ],
  });
  const fixture = TestBed.createComponent(UploadRequestDialog);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dialog = fixture.componentInstance as unknown as Record<string, any>;
  return { fixture, dialog, send, snackBar, clipboard, preview, el: fixture.nativeElement as HTMLElement };
}

describe('UploadRequestDialog (Send email)', () => {
  it('fills the template and the supplier address, then sends the email the customer edited', async () => {
    const { fixture, dialog, send, snackBar, el } = setup();
    await settle(fixture);
    expect(dialog['subject']()).toBe('[Your Company] asks for your halal certificates');
    expect(dialog['to']()).toEqual(['q@acme.test']);
    dialog['toggle'](2, false);
    dialog['cc'].set(['boss@khan.test']);
    dialog['message'].set('Dear [Supplier Name], please upload.');
    // 4 Nov 2026: submit through the real form, so a page reload would show (it must be prevented).
    const submitted = new Event('submit', { cancelable: true });
    el.querySelector('form')!.dispatchEvent(submitted);
    await settle(fixture);

    expect(submitted.defaultPrevented).toBe(true);
    expect(send).toHaveBeenCalledWith(5, { ingredient_ids: [1], certificate_type: 'halal', note: null, send_email: true,
      email: { to: ['q@acme.test'], cc: ['boss@khan.test'], bcc: [], subject: '[Your Company] asks for your halal certificates', message: 'Dear [Supplier Name], please upload.' } });
    expect(snackBar.open).toHaveBeenCalledWith('Email sent.', 'Close', { duration: 4000 });
    expect((el.querySelector('[data-test="link"]') as HTMLInputElement).value).toBe('https://globalhalalmarket.test/upload/abc');
    expect(el.querySelector('[data-test="sent-to"]')?.textContent).toContain('Emailed to q@acme.test at 4 Nov 2026');
  });

  it('shows the live preview for this supplier and the ticked ingredients', async () => {
    const { fixture, dialog, preview } = setup();
    await settle(fixture);
    dialog['toggle'](2, false);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, PREVIEW_DELAY_MS + 50));
    expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'upload_request', supplier_id: 5, ingredient_ids: [1] }));
  });

  it('asks for the chosen certificate type in the preview and the request (19 Nov 2026)', async () => {
    const send = vi.fn(() => of({ ...SENT, emailed_to_saved_address: false, email: { status: 'not_sent' as const, to: null, at: null } }));
    const { fixture, dialog, preview } = setup({ ...ACME, contact_email: null }, send);
    await settle(fixture);
    dialog['certificateType'].set('brcgs');
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, PREVIEW_DELAY_MS + 50));
    expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ certificate_type: 'brcgs' }));
    await dialog['submit'](false);
    expect(send).toHaveBeenCalledWith(5, expect.objectContaining({ certificate_type: 'brcgs' }));
  });

  it('creates the link only, without an email', async () => {
    const send = vi.fn(() => of({ ...SENT, emailed_to_saved_address: false, email: { status: 'not_sent' as const, to: null, at: null } }));
    const { fixture, dialog, el } = setup({ ...ACME, contact_email: null }, send);
    await settle(fixture);
    expect(dialog['to']()).toEqual([]);
    await dialog['submit'](false);
    await settle(fixture);
    expect(send).toHaveBeenCalledWith(5, { ingredient_ids: [1, 2], certificate_type: 'halal', note: null, send_email: false });
    expect(el.textContent).toContain('Not emailed.');
  });

  it('checks ingredients and recipients before sending and shows server messages', async () => {
    const error = new HttpErrorResponse({ status: 422, error: { errors: { 'email.to.0': ['Check the email addresses.'] } } });
    const { fixture, dialog, send, el } = setup(ACME, vi.fn(() => throwError(() => error)));
    await settle(fixture);
    dialog['toggle'](1, false);
    dialog['toggle'](2, false);
    await dialog['submit'](true);
    fixture.detectChanges();
    expect(el.textContent).toContain('Choose at least one ingredient.');

    dialog['toggle'](1, true);
    dialog['to'].set([]);
    await dialog['submit'](true);
    fixture.detectChanges();
    expect(el.textContent).toContain('Add at least one email address in To.');

    dialog['to'].set(['a@x.test', 'b@x.test', 'c@x.test']);
    dialog['cc'].set(['d@x.test', 'e@x.test']);
    dialog['bcc'].set(['f@x.test']);
    await dialog['submit'](true);
    fixture.detectChanges();
    expect(el.textContent).toContain('Send to at most 5 addresses in total');
    expect(send).not.toHaveBeenCalled();

    dialog['cc'].set([]);
    dialog['bcc'].set([]);
    await dialog['submit'](true);
    fixture.detectChanges();
    expect(el.textContent).toContain('Check the email addresses.');
  });

  it('copies the link and says when the email could not be sent', async () => {
    const { fixture, dialog, clipboard, el } = setup(ACME, vi.fn(() => of({ ...SENT, email: { status: 'failed' as const, to: 'q@acme.test', at: '2026-11-04T14:32:00Z' } })));
    await settle(fixture);
    await dialog['submit'](true);
    await settle(fixture);
    expect(el.textContent).toContain('The email could not be sent. Copy the link and send it yourself.');
    dialog['copy']();
    expect(clipboard.copy).toHaveBeenCalledWith('https://globalhalalmarket.test/upload/abc');
  });

  it('warns that a new link replaces the open one', async () => {
    const { fixture, el } = setup(ACME, vi.fn(() => of(SENT)), true);
    await settle(fixture);
    expect(el.querySelector('[data-test="replaces"]')?.textContent).toContain('Sending a new link stops the open link for this supplier.');
  });
});
