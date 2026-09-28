import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MarketsDialog } from './markets-dialog';
import { MarketsApi } from '../../core/api/markets-api';
import { MarketOption } from '../../core/models/markets';
import { settle } from '../../../testing/settle';

const OPTIONS: readonly MarketOption[] = [
  { code: 'BPJPH', market: 'Indonesia', market_slug: 'indonesia', authority: 'BPJPH', country_code: 'ID', data_note: null, selected: false },
];

function render(list: ReturnType<typeof vi.fn>) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: MarketsApi, useValue: { list, update: vi.fn(() => of(OPTIONS)) } },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(MarketsDialog);
  return { fixture, close, el: fixture.nativeElement as HTMLElement };
}

describe('MarketsDialog', () => {
  it('loads the markets once and closes with the saved list', async () => {
    const list = vi.fn(() => of(OPTIONS));
    const { fixture, close, el } = render(list);
    await settle(fixture);
    expect(list).toHaveBeenCalledTimes(1);
    expect(el.textContent).toContain('Indonesia · BPJPH');
    fixture.componentInstance.onSaved(OPTIONS);
    expect(close).toHaveBeenCalledWith(OPTIONS);
  });

  it('offers a retry when loading fails', async () => {
    const list = vi.fn().mockReturnValueOnce(throwError(() => new Error('down'))).mockReturnValue(of(OPTIONS));
    const { fixture, el } = render(list);
    await settle(fixture);
    expect(el.textContent).toContain('Markets could not be loaded.');
    (el.querySelector('[data-test="retry-markets"]') as HTMLButtonElement).click();
    await settle(fixture);
    expect(list).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('Indonesia · BPJPH');
  });
});
