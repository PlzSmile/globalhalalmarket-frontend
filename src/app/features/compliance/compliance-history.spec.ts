import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ComplianceHistory } from './compliance-history';
import { ComplianceApi } from '../../core/api/compliance-api';
import { settle } from '../../../testing/settle';

const HISTORY = { data: [
  { market: 'JAKIM', status: 'green', reasons: [], changed_at: '2026-10-05T09:00:00' },
  { market: 'JAKIM', status: null, reasons: [], changed_at: '2026-10-04T09:00:00' },
  { market: 'JAKIM', status: 'red', reasons: ['Gelatin — Acme Gelatin: no approved certificate'], changed_at: '2026-09-30T10:00:00' },
], meta: { current_page: 1, last_page: 1, per_page: 25, total: 3 } };

function setup(statusOn = vi.fn(() => of({ on: '2026-10-01', markets: [{ market: 'JAKIM', status: 'red', reasons: ['Gelatin — Acme Gelatin: no approved certificate'], changed_at: '2026-09-30T10:00:00' }] }))) {
  const history = vi.fn(() => of(HISTORY));
  TestBed.configureTestingModule({ providers: [{ provide: ComplianceApi, useValue: { history, statusOn } }] });
  const fixture = TestBed.createComponent(ComplianceHistory);
  fixture.componentRef.setInput('productId', 3);
  fixture.componentRef.setInput('version', 1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = fixture.componentInstance as unknown as Record<string, any>;
  return { fixture, component, history, statusOn, el: fixture.nativeElement as HTMLElement };
}

describe('ComplianceHistory', () => {
  it('lists the changes newest first and reloads when the version changes', async () => {
    const { fixture, history, el } = setup();
    await settle(fixture);
    expect(history).toHaveBeenCalledWith(3, 1);
    expect(el.textContent).toContain('5 Oct 2026, 09:00');
    expect(el.textContent).toContain('No longer tracked');
    expect(el.textContent).toContain('Gelatin — Acme Gelatin: no approved certificate');
    fixture.componentRef.setInput('version', 2);
    await settle(fixture);
    expect(history).toHaveBeenCalledTimes(2);
  });

  it('shows the status on a chosen date', async () => {
    const { fixture, component, statusOn, el } = setup();
    await settle(fixture);
    component['date'].setValue(new Date(2026, 9, 1));
    await component['showOn']();
    await settle(fixture);
    expect(statusOn).toHaveBeenCalledWith(3, '2026-10-01');
    expect(el.querySelector('[data-test="on-result"]')?.textContent).toContain('1 Oct 2026');
  });

  it('asks for a date and shows server errors', async () => {
    const failing = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'The on field must be a date before or equal to today.', errors: { on: ['The on field must be a date before or equal to today.'] } } })));
    const { fixture, component, statusOn, el } = setup(failing);
    await settle(fixture);
    await component['showOn']();
    await settle(fixture);
    expect(statusOn).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Enter a date.');
    component['date'].setValue(new Date(2030, 0, 1));
    await component['showOn']();
    await settle(fixture);
    expect(el.textContent).toContain('before or equal to today');
  });
});
