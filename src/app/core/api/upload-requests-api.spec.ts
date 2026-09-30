import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UploadRequestsApi } from './upload-requests-api';
import { SentUploadRequest, UploadRequestItem } from '../models/upload-requests';

const ITEM: UploadRequestItem = { id: 3, status: 'open', closed_reason: null, ingredients: [{ id: 1, name: 'Gelatin' }], note: null,
  expires_at: '2026-10-13T10:00:00+00:00', emailed_to_saved_address: true, uploads_count: 0, max_uploads: 5, created_at: '2026-09-29T10:00:00+00:00', requested_by: { id: 2, name: 'Aisha' } };

describe('UploadRequestsApi', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists a supplier\'s links', () => {
    let items: readonly UploadRequestItem[] = [];
    TestBed.inject(UploadRequestsApi).list(5).subscribe((r) => (items = r));
    backend.expectOne({ method: 'GET', url: '/api/v1/suppliers/5/upload-requests' }).flush({ data: [ITEM] });
    expect(items).toEqual([ITEM]);
  });

  it('sends a request and returns the link once', () => {
    let sent: SentUploadRequest | undefined;
    TestBed.inject(UploadRequestsApi).send(5, { ingredient_ids: [1], note: 'Hi', send_email: true }).subscribe((r) => (sent = r));
    const req = backend.expectOne({ method: 'POST', url: '/api/v1/suppliers/5/upload-requests' });
    expect(req.request.body).toEqual({ ingredient_ids: [1], note: 'Hi', send_email: true });
    req.flush({ data: { ...ITEM, link: 'https://x/upload/abc' } });
    expect(sent?.link).toBe('https://x/upload/abc');
  });

  it('cancels a link', () => {
    TestBed.inject(UploadRequestsApi).cancel(3).subscribe();
    backend.expectOne({ method: 'DELETE', url: '/api/v1/upload-requests/3' }).flush(null, { status: 204, statusText: 'No Content' });
  });
});
