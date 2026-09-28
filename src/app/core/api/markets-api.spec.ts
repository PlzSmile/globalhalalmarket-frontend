import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MarketsApi } from './markets-api';
import { MarketOption } from '../models/markets';

const OPTION: MarketOption = {
  code: 'BPJPH', market: 'Indonesia', market_slug: 'indonesia', authority: 'BPJPH', country_code: 'ID', data_note: null, selected: true,
};

describe('MarketsApi', () => {
  let api: MarketsApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(MarketsApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists the markets', () => {
    let result: readonly MarketOption[] = [];
    api.list().subscribe((r) => (result = r));
    backend.expectOne({ method: 'GET', url: '/api/v1/markets' }).flush({ data: [OPTION] });
    expect(result).toEqual([OPTION]);
  });

  it('saves the chosen authority codes', () => {
    let result: readonly MarketOption[] = [];
    api.update(['BPJPH', 'MOIAT']).subscribe((r) => (result = r));
    const req = backend.expectOne({ method: 'PUT', url: '/api/v1/markets' });
    expect(req.request.body).toEqual({ authority_codes: ['BPJPH', 'MOIAT'] });
    req.flush({ data: [OPTION] });
    expect(result).toEqual([OPTION]);
  });
});
