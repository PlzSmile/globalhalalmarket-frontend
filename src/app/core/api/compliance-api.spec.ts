import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ComplianceApi } from './compliance-api';

describe('ComplianceApi', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    return { api: TestBed.inject(ComplianceApi), http: TestBed.inject(HttpTestingController) };
  }

  it('sends only the filters that are set', async () => {
    const { api, http } = setup();
    const result = firstValueFrom(api.products({ market: 'JAKIM', status: 'red', supplier: 7, search: 'sausage', page: 2 }));
    const req = http.expectOne((r) => r.url === '/api/v1/compliance/products');
    expect(req.request.params.toString()).toBe('page=2&market=JAKIM&status=red&supplier=7&search=sausage');
    req.flush({ data: [], meta: { current_page: 2, last_page: 2, per_page: 25, total: 26 } });
    expect((await result).meta.total).toBe(26);

    void firstValueFrom(api.products({ market: null, status: null, supplier: null, search: '', page: 1 }));
    expect(http.expectOne((r) => r.url === '/api/v1/compliance/products').request.params.toString()).toBe('page=1');
  });

  it('loads the breakdown, the history and the status on a date', async () => {
    const { api, http } = setup();
    const breakdown = firstValueFrom(api.product(3));
    http.expectOne('/api/v1/compliance/products/3').flush({ data: [{ market: 'JAKIM' }] });
    expect((await breakdown)[0].market).toBe('JAKIM');

    void firstValueFrom(api.history(3, 2));
    expect(http.expectOne((r) => r.url === '/api/v1/compliance/products/3/history').request.params.get('page')).toBe('2');

    const on = firstValueFrom(api.statusOn(3, '2026-10-01'));
    const req = http.expectOne((r) => r.url === '/api/v1/compliance/products/3/history');
    expect(req.request.params.get('on')).toBe('2026-10-01');
    req.flush({ data: { on: '2026-10-01', markets: [] } });
    expect((await on).on).toBe('2026-10-01');
  });
});
