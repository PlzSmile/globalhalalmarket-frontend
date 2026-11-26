import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { RemindersTab, reminderLabel } from './reminders-tab';
import { MeApi } from '../../core/api/me-api';
import { ActivityApi } from '../../core/api/activity-api';
import { AuthService } from '../../core/auth/auth.service';
import { CompanyReminders } from '../../core/models/auth';
import { settle } from '../../../testing/settle';

const SETTINGS: CompanyReminders = { certificates: true, recognitions: true, auto_chase_suppliers: true, certificate_days: [7, 60, 30], chase_days: 30 };

async function render(canManage: boolean) {
  const api = {
    company: vi.fn(() => of({ id: 5, name: 'Khan Foods', reminders: SETTINGS })),
    updateReminders: vi.fn((change: Partial<CompanyReminders>) => of({ id: 5, name: 'Khan Foods', reminders: { ...SETTINGS, ...change } })),
  };
  const activity = {
    page: vi.fn(() => of({ data: [{ id: 1, at: '2026-11-14T10:00:00Z', actor: 'Aisha Khan', event: 'reminders_changed', description: 'Reminder settings changed',
      changes: [{ field: 'Certificate reminders', from: '60, 30, 7 days', to: '60, 30, 14 days' }], link: null }], meta: { next_cursor: null } })),
  };
  const snackBar = { open: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: MeApi, useValue: api },
      { provide: ActivityApi, useValue: activity },
      { provide: AuthService, useValue: { canManageTeam: () => canManage } },
      { provide: MatSnackBar, useValue: snackBar },
    ],
  });
  const fixture = TestBed.createComponent(RemindersTab);
  await settle(fixture);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { fixture, api, activity, snackBar, tab: fixture.componentInstance as unknown as Record<string, any>, el: fixture.nativeElement as HTMLElement };
}

const labels = (el: HTMLElement): string[] => Array.from(el.querySelectorAll('.reminder__label')).map((e) => e.textContent?.trim() ?? '');

describe('RemindersTab', () => {
  it('names the days in plain words', () => {
    expect(reminderLabel(0)).toBe('Expires today');
    expect(reminderLabel(1)).toBe('Expires tomorrow');
    expect(reminderLabel(30)).toBe('Expires in 30 days');
  });

  it('shows the reminders soonest last, the status and the history', async () => {
    const { el, activity } = await render(true);
    expect(labels(el)).toEqual(['Expires in 60 days', 'Expires in 30 days', 'Expires in 7 days']);
    expect(el.querySelector('[data-test="reminders-status"]')?.textContent).toContain('Expiry reminders: On');
    expect(activity.page).toHaveBeenCalledWith(null, 'reminders_changed');
    expect(el.textContent).toContain('Certificate reminders: 60, 30, 14 days');
    expect((el.querySelector('[data-test="save"]') as HTMLButtonElement).disabled).toBe(true); // nothing changed yet
  });

  it('edits a day, adds and removes a reminder, then saves everything at once', async () => {
    const { fixture, api, snackBar, tab, el } = await render(true);
    tab['editing'].set(2);
    tab['setDay'](2, '14');
    tab['add']();
    await settle(fixture);
    expect(tab['draft']().certificate_days).toEqual([60, 30, 14, 1]);
    tab['remove'](0);
    tab['set']({ chase_days: 21 });
    await settle(fixture);
    expect(labels(el)).toEqual(['Expires in 30 days', 'Expires in 14 days', 'Expires tomorrow']);

    (el.querySelector('[data-test="save"]') as HTMLButtonElement).click();
    await settle(fixture);
    expect(api.updateReminders).toHaveBeenCalledWith({ ...SETTINGS, certificate_days: [30, 14, 1], chase_days: 21 });
    expect(snackBar.open).toHaveBeenCalledWith('Reminder settings saved.', 'Close', { duration: 4000 });
  });

  it('refuses two reminders on the same day or a day out of range', async () => {
    const { fixture, tab, el } = await render(true);
    tab['setDay'](0, '30');
    await settle(fixture);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('same day');
    tab['setDay'](0, '400');
    await settle(fixture);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('0 to 180');
    expect((el.querySelector('[data-test="save"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('is read-only for members', async () => {
    const { el, activity } = await render(false);
    expect(el.textContent).toContain('Only owners and admins can change these.');
    expect((el.querySelector('[data-test="reminder-add"]') as HTMLButtonElement).disabled).toBe(true);
    expect(el.querySelector('[data-test="toggle-certificates"] input')?.hasAttribute('disabled')).toBe(true);
    expect(activity.page).not.toHaveBeenCalled();
  });
});
