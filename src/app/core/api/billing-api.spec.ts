import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BillingApi } from './billing-api';

describe('BillingApi', () => {
  let api: BillingApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(BillingApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('changes plan and cancels through the billing endpoints', () => {
    api.swap('pro', 'yearly').subscribe();
    const swap = backend.expectOne({ method: 'POST', url: '/api/v1/billing/swap' });
    expect(swap.request.body).toEqual({ plan: 'pro', interval: 'yearly' });
    swap.flush({ data: {} });

    api.cancel().subscribe();
    backend.expectOne({ method: 'POST', url: '/api/v1/billing/cancel' }).flush({ data: {} });
  });

  it('returns the Paddle links and escapes invoice ids', () => {
    let url = '';
    api.invoiceUrl('txn/1').subscribe((u) => (url = u));
    backend.expectOne('/api/v1/billing/invoices/txn%2F1').flush({ data: { url: 'https://paddle.example/1.pdf' } });
    expect(url).toBe('https://paddle.example/1.pdf');
    expect(api.checkoutUrl('starter', 'monthly')).toBe('/billing/checkout/starter/monthly');
  });
});
