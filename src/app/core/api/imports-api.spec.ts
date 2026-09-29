import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ImportsApi } from './imports-api';
import { ImportPreview } from '../models/imports';

const COUNTS = { products: { create: 1, reuse: 0 }, ingredients: { create: 1, reuse: 0 }, suppliers: { create: 0, reuse: 0, fill: 0 }, links: { add: 1, existing: 0 } };

describe('ImportsApi', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('previews a file as multipart and unwraps data', () => {
    const file = new File(['product_name,ingredient\nA,B\n'], 'c.csv', { type: 'text/csv' });
    let preview: ImportPreview | undefined;
    TestBed.inject(ImportsApi).preview(file).subscribe((p) => (preview = p));

    const req = backend.expectOne({ method: 'POST', url: '/api/v1/imports/catalogue/preview' });
    const sent = (req.request.body as FormData).get('file') as File;
    expect([sent.name, sent.size]).toEqual([file.name, file.size]);
    req.flush({ data: { fingerprint: 'f', counts: COUNTS, warnings: [], errors: [], errors_total: 0, can_import: true } });
    expect(preview?.fingerprint).toBe('f');
  });

  it('imports the same file with its fingerprint', () => {
    const file = new File(['x'], 'c.csv', { type: 'text/csv' });
    TestBed.inject(ImportsApi).import(file, 'abc').subscribe();

    const req = backend.expectOne({ method: 'POST', url: '/api/v1/imports/catalogue' });
    const body = req.request.body as FormData;
    expect([(body.get('file') as File).name, (body.get('file') as File).size]).toEqual([file.name, file.size]);
    expect(body.get('fingerprint')).toBe('abc');
    req.flush({ data: { counts: COUNTS } });
  });

  it('points at the template download', () => {
    expect(TestBed.inject(ImportsApi).templateUrl).toBe('/api/v1/imports/catalogue/template');
  });
});
