import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { RemindersTab } from './reminders-tab';
import { MeApi } from '../../core/api/me-api';
import { AuthService } from '../../core/auth/auth.service';
import { CompanyReminders } from '../../core/models/auth';
import { settle } from '../../../testing/settle';

const SETTINGS: CompanyReminders = { certificates: true, recognitions: true, auto_chase_suppliers: true };

async function render(canManage: boolean) {
  const api = {
    company: vi.fn(() => of({ id: 5, name: 'Khan Foods', reminders: SETTINGS })),
    updateReminders: vi.fn((change: Partial<CompanyReminders>) => of({ id: 5, name: 'Khan Foods', reminders: { ...SETTINGS, ...change } })),
  };
  const snackBar = { open: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: MeApi, useValue: api },
      { provide: AuthService, useValue: { canManageTeam: () => canManage } },
      { provide: MatSnackBar, useValue: snackBar },
    ],
  });
  const fixture = TestBed.createComponent(RemindersTab);
  await settle(fixture);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { fixture, api, snackBar, tab: fixture.componentInstance as unknown as Record<string, any>, el: fixture.nativeElement as HTMLElement };
}

describe('RemindersTab', () => {
  it('shows the three settings and saves a change', async () => {
    const { fixture, api, snackBar, tab, el } = await render(true);
    expect(el.querySelectorAll('mat-slide-toggle').length).toBe(3);

    await tab['change']('auto_chase_suppliers', false);
    await settle(fixture);

    expect(api.updateReminders).toHaveBeenCalledWith({ auto_chase_suppliers: false });
    expect(tab['settings']()).toEqual({ ...SETTINGS, auto_chase_suppliers: false });
    expect(snackBar.open).toHaveBeenCalledWith('Reminder settings saved.', 'Close', { duration: 4000 });
  });

  it('is read-only for members', async () => {
    const { el } = await render(false);
    const toggles = Array.from(el.querySelectorAll('button[role="switch"]')) as HTMLButtonElement[];
    expect(toggles.length).toBe(3);
    expect(toggles.every((t) => t.disabled)).toBe(true);
    expect(el.textContent).toContain('Only owners and admins can change these.');
  });
});
