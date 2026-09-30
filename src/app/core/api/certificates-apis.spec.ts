import { TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CertificatesApi } from './certificates-api';
import { BodiesApi } from './bodies-api';
import { CertificateDetail, UploadEvent } from '../models/certificates';

const DETAIL = { id: 1, status: 'approved', body: null, body_name_other: 'X', supplier: { id: 5, name: 'Acme' } } as unknown as CertificateDetail;

describe('certificate APIs', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists with only the filters that are set', () => {
    TestBed.inject(CertificatesApi).list({ search: 'acme', status: 'pending', supplierId: 5, expiring: true, archived: false, page: 2 }).subscribe();
    backend.expectOne((r) => r.url === '/api/v1/certificates' && r.params.get('search') === 'acme' && r.params.get('status') === 'pending'
      && r.params.get('supplier_id') === '5' && r.params.get('expiring') === '1' && r.params.get('page') === '2').flush({ data: [], meta: {} });
    TestBed.inject(CertificatesApi).list({ search: '', status: null, supplierId: null, expiring: false, archived: false, page: 1 }).subscribe();
    backend.expectOne((r) => r.url === '/api/v1/certificates' && r.params.keys().join() === 'page').flush({ data: [], meta: {} });
  });

  it('uploads as multipart with progress', () => {
    const events: UploadEvent[] = [];
    const file = new File(['%PDF-1.4'], 'cert.pdf', { type: 'application/pdf' });
    TestBed.inject(CertificatesApi).create({
      supplier_id: 5, certification_body_id: null, body_name_other: 'Midlands Board', certificate_number: null, scope: null,
      issued_on: null, expires_on: '2027-01-01', ingredient_ids: [3, 4],
    }, file).subscribe((e) => events.push(e));

    const req = backend.expectOne({ method: 'POST', url: '/api/v1/certificates' });
    const body = req.request.body as FormData;
    expect(body.get('supplier_id')).toBe('5');
    expect(body.get('body_name_other')).toBe('Midlands Board');
    expect(body.has('certification_body_id')).toBe(false);
    expect(body.getAll('ingredient_ids[]')).toEqual(['3', '4']);
    expect((body.get('file') as File).name).toBe('cert.pdf');
    req.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 });
    req.flush({ data: DETAIL });
    expect(events).toEqual([{ kind: 'progress', percent: 50 }, { kind: 'done', certificate: DETAIL }]);
  });

  it('reviews, asks for download links and searches bodies', () => {
    const api = TestBed.inject(CertificatesApi);
    api.reject(1, 'Unreadable').subscribe();
    expect(backend.expectOne({ method: 'POST', url: '/api/v1/certificates/1/reject' }).request.body).toEqual({ reason: 'Unreadable' });
    api.downloadLink(1).subscribe();
    backend.expectOne({ method: 'POST', url: '/api/v1/certificates/1/download-link' }).flush({ url: '/files/x', expires_at: 'y' });
    TestBed.inject(BodiesApi).search('hmc').subscribe();
    backend.expectOne((r) => r.url === '/api/v1/reference/bodies' && r.params.get('search') === 'hmc').flush({ data: [] });
  });

  it('archives, restores, lists archived and saves scope decisions', () => {
    const api = TestBed.inject(CertificatesApi);

    api.archive(4).subscribe();
    backend.expectOne({ method: 'DELETE', url: '/api/v1/certificates/4' }).flush(null);

    api.restore(4).subscribe();
    backend.expectOne({ method: 'POST', url: '/api/v1/certificates/4/restore' }).flush({ data: DETAIL });

    api.list({ search: '', status: null, supplierId: null, expiring: false, archived: true, page: 1 }).subscribe();
    backend.expectOne((r) => r.url === '/api/v1/certificates' && r.params.get('archived') === '1').flush({ data: [], meta: {} });

    let by: string | null = null;
    api.setScopeCheck(4, 'JAKIM', 'not_covered', 'Meat only').subscribe((check) => (by = check.by));
    const put = backend.expectOne({ method: 'PUT', url: '/api/v1/certificates/4/scope-checks/JAKIM' });
    expect(put.request.body).toEqual({ result: 'not_covered', note: 'Meat only' });
    put.flush({ data: { result: 'not_covered', note: 'Meat only', by: 'Ana', at: '2026-09-30T10:00:00+00:00' } });
    expect(by).toBe('Ana');

    api.clearScopeCheck(4, 'JAKIM').subscribe();
    backend.expectOne({ method: 'DELETE', url: '/api/v1/certificates/4/scope-checks/JAKIM' }).flush(null);
  });
});
