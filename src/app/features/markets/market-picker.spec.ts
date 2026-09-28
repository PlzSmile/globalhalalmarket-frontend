import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MarketPicker } from './market-picker';
import { MarketsApi } from '../../core/api/markets-api';
import { MarketOption } from '../../core/models/markets';

const OPTIONS: readonly MarketOption[] = [
  { code: 'BPJPH', market: 'Indonesia', market_slug: 'indonesia', authority: 'BPJPH', country_code: 'ID', data_note: 'Scope and validity.', selected: true },
  { code: 'JAKIM', market: 'Malaysia', market_slug: 'malaysia', authority: 'JAKIM', country_code: 'MY', data_note: null, selected: false },
  { code: 'MOIAT', market: 'United Arab Emirates', market_slug: 'uae', authority: 'MoIAT', country_code: 'AE', data_note: null, selected: false },
];

function render(readonly = false, update = vi.fn(() => of(OPTIONS))) {
  TestBed.configureTestingModule({ providers: [{ provide: MarketsApi, useValue: { update } }] });
  const fixture = TestBed.createComponent(MarketPicker);
  fixture.componentRef.setInput('markets', OPTIONS);
  fixture.componentRef.setInput('readonly', readonly);
  fixture.detectChanges();
  return { fixture, update, el: fixture.nativeElement as HTMLElement };
}

function checkbox(el: HTMLElement, code: string): HTMLInputElement {
  return el.querySelector(`[data-test="market-${code}"] input[type="checkbox"]`) as HTMLInputElement;
}

describe('MarketPicker', () => {
  it('shows every market with its note, ticked as saved', () => {
    const { el } = render();
    expect(el.textContent).toContain('Indonesia · BPJPH');
    expect(el.textContent).toContain('Scope and validity.');
    expect(checkbox(el, 'BPJPH').checked).toBe(true);
    expect(checkbox(el, 'JAKIM').checked).toBe(false);
  });

  it('asks for at least one market and does not call the API', async () => {
    const { fixture, update, el } = render();
    checkbox(el, 'BPJPH').click();
    fixture.detectChanges();
    await fixture.componentInstance.save();
    fixture.detectChanges();
    expect(update).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Choose at least one market.');
  });

  it('saves the ticked codes in list order and emits the saved list', async () => {
    const { fixture, update, el } = render();
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    checkbox(el, 'MOIAT').click();
    fixture.detectChanges();
    await fixture.componentInstance.save();
    expect(update).toHaveBeenCalledWith(['BPJPH', 'MOIAT']);
    expect(saved).toHaveBeenCalledWith(OPTIONS);
  });

  it('disables Save while saving', () => {
    const pending = new Subject<readonly MarketOption[]>();
    const { fixture, el } = render(false, vi.fn(() => pending.asObservable()));
    void fixture.componentInstance.save();
    fixture.detectChanges();
    expect((el.querySelector('[data-test="save-markets"]') as HTMLButtonElement).disabled).toBe(true);
    pending.next(OPTIONS);
    pending.complete();
  });

  it('shows the server message when saving is refused', async () => {
    const error = new HttpErrorResponse({ status: 422, error: { errors: { authority_codes: ['Choose markets from the list.'] } } });
    const { fixture, el } = render(false, vi.fn(() => throwError(() => error)));
    await fixture.componentInstance.save();
    fixture.detectChanges();
    expect(el.textContent).toContain('Choose markets from the list.');
  });

  it('explains a 403 (role changed meanwhile)', async () => {
    const { fixture, el } = render(false, vi.fn(() => throwError(() => new HttpErrorResponse({ status: 403 }))));
    await fixture.componentInstance.save();
    fixture.detectChanges();
    expect(el.textContent).toContain('Only owners and admins can change markets.');
  });

  it('is read-only for members: disabled boxes, no Save button', () => {
    const { el } = render(true);
    expect(checkbox(el, 'BPJPH').disabled).toBe(true);
    expect(el.querySelector('[data-test="save-markets"]')).toBeNull();
  });
});
