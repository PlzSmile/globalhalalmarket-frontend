import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { MarketsTab } from './markets-tab';
import { MarketsApi } from '../../core/api/markets-api';
import { AuthService } from '../../core/auth/auth.service';
import { MarketOption } from '../../core/models/markets';
import { settle } from '../../../testing/settle';

const OPTIONS: readonly MarketOption[] = [
  { code: 'JAKIM', market: 'Malaysia', market_slug: 'malaysia', authority: 'JAKIM', country_code: 'MY', data_note: null, selected: true },
];

async function render(canManage: boolean) {
  const snackBar = { open: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: MarketsApi, useValue: { list: vi.fn(() => of(OPTIONS)), update: vi.fn(() => of(OPTIONS)) } },
      { provide: AuthService, useValue: { canManageTeam: () => canManage } },
      { provide: MatSnackBar, useValue: snackBar },
    ],
  });
  const fixture = TestBed.createComponent(MarketsTab);
  await settle(fixture);
  return { fixture, snackBar, el: fixture.nativeElement as HTMLElement };
}

describe('MarketsTab', () => {
  it('lets owners and admins save, with a confirmation', async () => {
    const { fixture, snackBar, el } = await render(true);
    expect(el.querySelector('[data-test="save-markets"]')).not.toBeNull();
    fixture.componentInstance.onSaved(OPTIONS);
    expect(snackBar.open).toHaveBeenCalledWith('Markets saved.', 'Close', { duration: 4000 });
  });

  it('is read-only for members, with an explanation', async () => {
    const { el } = await render(false);
    expect(el.querySelector('[data-test="save-markets"]')).toBeNull();
    expect(el.textContent).toContain('Only owners and admins can change markets.');
  });
});
