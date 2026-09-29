import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CertificateDetailPage } from './certificate-detail';
import { CertificatesApi } from '../../core/api/certificates-api';
import { BrowserNavigation } from '../../core/browser/navigation';
import { CertificateDetail } from '../../core/models/certificates';
import { settle } from '../../../testing/settle';

const CERT: CertificateDetail = { id: 1, status: 'pending', body: { id: 9, name: 'Halal Monitoring Committee' }, body_name_other: null,
  supplier: { id: 5, name: 'Acme Gelatin' }, certificate_number: 'HMC-1', scope: 'Gelatin', issued_on: '2026-01-10', expires_on: '2027-01-09',
  ingredients_count: 1, ingredients: [{ id: 3, name: 'Gelatin' }], file: { original_name: 'acme.pdf', size: 204800 },
  reviewed_by: null, reviewed_at: null, rejection_reason: null, created_at: null };

function setup(api: Record<string, unknown> = {}, dialogResult: unknown = true) {
  const certificates = { get: vi.fn(() => of(CERT)), approve: vi.fn(() => of({ ...CERT, status: 'approved' })), reject: vi.fn(() => of({ ...CERT, status: 'rejected' })),
    remove: vi.fn(() => of(undefined)), downloadLink: vi.fn(() => of({ url: '/files/certificates/1?signature=x', expires_at: 'soon' })), ...api };
  const navigation = { assign: vi.fn() };
  const snackBar = { open: vi.fn() };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(dialogResult) })) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CertificatesApi, useValue: certificates },
      { provide: BrowserNavigation, useValue: navigation },
      { provide: MatDialog, useValue: dialog },
      { provide: MatSnackBar, useValue: snackBar },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(CertificateDetailPage);
  fixture.componentRef.setInput('id', '1');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const page = fixture.componentInstance as unknown as Record<string, any>;
  return { fixture, page, certificates, navigation, snackBar, dialog, navigate, el: fixture.nativeElement as HTMLElement };
}

describe('CertificateDetailPage', () => {
  it('shows the details, dates, file and status', async () => {
    const { fixture, el } = setup();
    await settle(fixture);
    expect(el.querySelector('h1')?.textContent).toContain('Halal Monitoring Committee');
    expect(el.textContent).toContain('Acme Gelatin');
    expect(el.textContent).toContain('9 Jan 2027');
    expect(el.textContent).toContain('acme.pdf');
    expect(el.textContent).toContain('200 KB');
    expect(el.textContent).toContain('Pending review');
  });

  it('downloads through a fresh signed link without storing it', async () => {
    const { fixture, page, certificates, navigation } = setup();
    await settle(fixture);
    await page['download']();
    expect(certificates.downloadLink).toHaveBeenCalledWith(1);
    expect(navigation.assign).toHaveBeenCalledWith('/files/certificates/1?signature=x');
  });

  it('approves, and rejects with a reason from the dialog', async () => {
    const { fixture, page, certificates, snackBar, dialog } = setup();
    await settle(fixture);
    await page['approve']();
    expect(certificates.approve).toHaveBeenCalledWith(1);
    expect(snackBar.open).toHaveBeenCalledWith('Certificate approved.', 'Close', { duration: 4000 });
    await page['reject']();
    const data = (dialog.open.mock.calls[0] as unknown[])[1] as { data: { save: (reason: string) => unknown } };
    data.data.save('Unreadable scan');
    expect(certificates.reject).toHaveBeenCalledWith(1, 'Unreadable scan');
  });

  it('deletes after confirming and goes back to the list', async () => {
    const { fixture, page, certificates, navigate } = setup();
    await settle(fixture);
    await page['deleteCertificate']();
    expect(certificates.remove).toHaveBeenCalledWith(1);
    expect(navigate).toHaveBeenCalledWith(['/certificates']);
  });

  it('shows not found', async () => {
    const { fixture, el } = setup({ get: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))) });
    await settle(fixture);
    expect(el.textContent).toContain('Certificate not found');
  });

  it('shows who reviewed it and when, without a stray space', async () => {
    const reviewed = { ...CERT, status: 'approved' as const, reviewed_by: { id: 2, name: 'Ana Reviewer' }, reviewed_at: '2026-09-29T09:00:00+00:00' };
    const { fixture, el } = setup({ get: vi.fn(() => of(reviewed)) });
    await settle(fixture);
    expect(el.textContent?.replace(/\s+/g, ' ')).toContain('Ana Reviewer, 29 Sep 2026');
  });

  it('only follows download links to the certificate file route', async () => {
    const { fixture, page, navigation, snackBar } = setup({ downloadLink: vi.fn(() => of({ url: 'https://evil.example/x.pdf', expires_at: 'soon' })) });
    await settle(fixture);
    await page['download']();
    expect(navigation.assign).not.toHaveBeenCalled();
    expect(snackBar.open).toHaveBeenCalledWith('The PDF could not be downloaded. Please try again.', 'Close', { duration: 6000 });
  });
});
