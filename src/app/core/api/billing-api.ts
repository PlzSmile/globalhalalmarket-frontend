import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiItem, PlanKey } from '../models/auth';
import { Billing, BillingInterval, Invoice } from '../models/billing';

/** Phase 7a: Settings → Billing. Paying itself happens on the server-rendered checkout page (Paddle). */
@Injectable({ providedIn: 'root' })
export class BillingApi {
  private readonly http = inject(HttpClient);

  show(): Observable<Billing> {
    return this.http.get<ApiItem<Billing>>('/api/v1/billing').pipe(map((r) => r.data));
  }

  swap(plan: PlanKey, interval: BillingInterval): Observable<Billing> {
    return this.http.post<ApiItem<Billing>>('/api/v1/billing/swap', { plan, interval }).pipe(map((r) => r.data));
  }

  cancel(): Observable<Billing> {
    return this.http.post<ApiItem<Billing>>('/api/v1/billing/cancel', {}).pipe(map((r) => r.data));
  }

  resume(): Observable<Billing> {
    return this.http.post<ApiItem<Billing>>('/api/v1/billing/resume', {}).pipe(map((r) => r.data));
  }

  paymentMethodUrl(): Observable<string> {
    return this.http.get<ApiItem<{ url: string }>>('/api/v1/billing/payment-method').pipe(map((r) => r.data.url));
  }

  invoices(): Observable<readonly Invoice[]> {
    return this.http.get<ApiItem<readonly Invoice[]>>('/api/v1/billing/invoices').pipe(map((r) => r.data));
  }

  invoiceUrl(id: string): Observable<string> {
    return this.http.get<ApiItem<{ url: string }>>(`/api/v1/billing/invoices/${encodeURIComponent(id)}`).pipe(map((r) => r.data.url));
  }

  /** Full-page navigation: the checkout is a server page with its own Content-Security-Policy. */
  checkoutUrl(plan: PlanKey, interval: BillingInterval): string {
    return `/billing/checkout/${plan}/${interval}`;
  }
}
