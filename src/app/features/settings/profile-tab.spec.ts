import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { ProfileTab } from './profile-tab';
import { AuthService } from '../../core/auth/auth.service';
import { MeApi } from '../../core/api/me-api';

/** 19 Nov 2026 (Bilal): the password sits in the Profile card and opens only after the emailed code. */
describe('ProfileTab', () => {
  function setup(codeConfirmed: boolean) {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: signal({ name: 'Aisha Khan', email: 'aisha@demo.example', role: 'owner', company: { name: 'Demo Foods' } }), canManageTeam: signal(true), setUser: () => undefined } },
        { provide: MeApi, useValue: { twoFactor: () => of({ app: false, recovery_codes_left: 0 }), changePassword: () => of(undefined) } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(codeConfirmed) }) } },
      ],
    });
    const fixture = TestBed.createComponent(ProfileTab);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the password as a locked field until the code is confirmed', () => {
    const el = setup(false).nativeElement as HTMLElement;
    expect(el.querySelector('[data-test="profile-password-locked"]')).not.toBeNull();
    expect(el.querySelector('[data-test="profile-password-form"]')).toBeNull();
    expect(el.textContent).not.toContain('Change password');
    expect(el.textContent).toContain('To change your profile or password, we email you a code first');
  });

  it('opens the password fields inside the Profile card after the emailed code', async () => {
    const fixture = setup(true);
    await fixture.componentInstance.unlock();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-test="profile-password-form"]')).not.toBeNull();
    expect(el.querySelector('[data-test="profile-password-locked"]')).toBeNull();
    expect(el.querySelectorAll('mat-card').length).toBe(2); // Profile + Two-step log-in: no separate password card
  });
});
