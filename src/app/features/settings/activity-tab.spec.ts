import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ActivityTab } from './activity-tab';
import { ActivityApi, ActivityEntry } from '../../core/api/activity-api';

const ENTRY: ActivityEntry = {
  id: 2, at: '2026-10-25T09:30:00+00:00', actor: 'Aisha Khan', event: 'certificate_changed',
  description: 'Changed certificate HC-7 from Demo Spice Traders', link: '/certificates/7',
  changes: [{ field: 'Expiry date', from: '1 Jun 2027', to: '1 Sep 2027' }],
};

function setup(page: () => unknown) {
  const api = { page: vi.fn(page) };
  const snackBar = { open: vi.fn() };
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ActivityApi, useValue: api }, { provide: MatSnackBar, useValue: snackBar }] });
  const fixture = TestBed.createComponent(ActivityTab);
  return { fixture, api, snackBar, el: fixture.nativeElement as HTMLElement };
}

describe('ActivityTab (Phase 7)', () => {
  it('lists who changed what with old and new values and a link', async () => {
    const { fixture, el } = setup(() => of({ data: [ENTRY], meta: { next_cursor: null } }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelectorAll('[data-test="activity-item"]').length).toBe(1);
    expect(el.textContent).toContain('Aisha Khan');
    expect(el.textContent).toContain('Expiry date: 1 Jun 2027 → 1 Sep 2027');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/certificates/7');
    expect(el.querySelector('[data-test="activity-more"]')).toBeNull();
  });

  it('loads older lines with the cursor and keeps the first ones', async () => {
    const pages = [{ data: [ENTRY], meta: { next_cursor: 'abc' } }, { data: [{ ...ENTRY, id: 1, link: null }], meta: { next_cursor: null } }];
    const { fixture, el, api } = setup(() => of(pages.shift()));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    (el.querySelector('[data-test="activity-more"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.page).toHaveBeenLastCalledWith('abc');
    expect(el.querySelectorAll('[data-test="activity-item"]').length).toBe(2);
  });

  it('shows an empty state, and a message when loading fails', async () => {
    const empty = setup(() => of({ data: [], meta: { next_cursor: null } }));
    empty.fixture.detectChanges();
    await empty.fixture.whenStable();
    empty.fixture.detectChanges();
    expect(empty.el.textContent).toContain('Nothing yet');

    TestBed.resetTestingModule();
    const failing = setup(() => throwError(() => new Error('down')));
    failing.fixture.detectChanges();
    await failing.fixture.whenStable();
    expect(failing.snackBar.open).toHaveBeenCalledWith('The activity log could not be loaded. Please try again.', 'Close', { duration: 6000 });
  });
});
