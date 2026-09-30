import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DashboardApi } from './dashboard-api';
import { DashboardData } from '../models/dashboard';

describe('DashboardApi', () => {
  it('loads the dashboard', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const backend = TestBed.inject(HttpTestingController);
    const data: DashboardData = { markets: [], onboarding: { steps: [{ key: 'markets', status: 'todo' }] }, product_count: 0,
      compliance: { computed_at: null, summary: { overall: { green: 0, amber: 0, red: 0 }, markets: [] }, upcoming_expiries: [] } };
    let result: DashboardData | undefined;

    TestBed.inject(DashboardApi).get().subscribe((r) => (result = r));
    backend.expectOne({ method: 'GET', url: '/api/v1/dashboard' }).flush({ data });

    expect(result).toEqual(data);
    backend.verify();
  });
});
