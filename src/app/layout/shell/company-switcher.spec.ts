import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CompanySwitcher } from './company-switcher';
import { CompaniesApi } from '../../core/api/companies-api';
import { AuthService } from '../../core/auth/auth.service';

const CONSULTANT = { id: 1, name: 'Aisha', email: 'a@example.com', role: 'owner', email_verified: true, company: { id: 5, name: 'Khan Consulting' }, can_switch_companies: true, viewing_client: false };

function setup(user: Record<string, unknown> = CONSULTANT) {
  const api = {
    list: vi.fn(() => of({ data: [{ id: 5, name: 'Khan Consulting', is_client: false, current: true }, { id: 9, name: 'Client Foods', is_client: true, current: false }], meta: { can_manage: true, max_clients: 10 } })),
    switchTo: vi.fn(() => of({ ...CONSULTANT, company: { id: 9, name: 'Client Foods' }, viewing_client: true })),
    addClient: vi.fn(() => of({ id: 10, name: 'New Client', is_client: true, current: false })),
  };
  const auth = { user: signal(user), setUser: vi.fn() };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(true) })) };
  const snackBar = { open: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: CompaniesApi, useValue: api }, { provide: AuthService, useValue: auth },
      { provide: MatDialog, useValue: dialog }, { provide: MatSnackBar, useValue: snackBar },
    ],
  });
  const fixture = TestBed.createComponent(CompanySwitcher);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cmp = fixture.componentInstance as unknown as Record<string, any>;
  return { fixture, cmp, api, auth, dialog, snackBar, el: fixture.nativeElement as HTMLElement };
}

describe('CompanySwitcher (Phase 7c)', () => {
  it('shows a plain company name to users who cannot switch', () => {
    const { el } = setup({ ...CONSULTANT, can_switch_companies: false });
    expect(el.querySelector('[data-test="company-switcher"]')).toBeNull();
    expect(el.textContent).toContain('Khan Consulting');
  });

  it('offers the menu to a consultant and loads the companies when opened', async () => {
    const { el, cmp, api } = setup();
    expect(el.querySelector('[data-test="company-switcher"]')).not.toBeNull();
    await cmp['load']();
    expect(api.list).toHaveBeenCalled();
    expect(cmp['companies']()?.data.length).toBe(2);
  });

  it('switches, keeps the new user and reloads the app', async () => {
    const { cmp, api, auth } = setup();
    const reload = vi.spyOn(cmp as unknown as { reload: () => void }, 'reload').mockImplementation(() => undefined);
    await cmp['switchTo'](9);
    expect(api.switchTo).toHaveBeenCalledWith(9);
    expect(auth.setUser).toHaveBeenCalledWith(expect.objectContaining({ viewing_client: true }));
    expect(reload).toHaveBeenCalled();
  });

  it('adds a client company through the name dialog and refreshes the list', async () => {
    const { cmp, dialog, api, snackBar } = setup();
    cmp['addClient']();
    expect(dialog.open).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
    expect(api.list).toHaveBeenCalled();
    expect(snackBar.open).toHaveBeenCalledWith('Client company added. Pick it in the company menu to work on it.', 'Close', { duration: 5000 });
  });

  it('marks that a client company is being viewed', () => {
    const { el } = setup({ ...CONSULTANT, viewing_client: true });
    expect(el.querySelector('.switcher__client')?.textContent).toContain('Client');
  });
});
