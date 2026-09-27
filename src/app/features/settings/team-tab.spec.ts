import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { TeamTab } from './team-tab';
import { TeamApi } from '../../core/api/team-api';
import { AuthService } from '../../core/auth/auth.service';
import { Team } from '../../core/models/auth';

const TEAM: Team = {
  members: [
    { id: 1, name: 'Aisha', email: 'aisha@example.com', role: 'owner', email_verified: true, is_you: false },
    { id: 2, name: 'Bilal', email: 'bilal@example.com', role: 'member', email_verified: true, is_you: true },
    { id: 3, name: 'Chris', email: 'chris@example.com', role: 'member', email_verified: true, is_you: false },
  ],
  invitations: [{ id: 9, email: 'new@example.com', role: 'admin', expires_at: '2026-10-04T10:00:00+00:00', invited_by: 'Aisha' }],
};

async function render(canManage: boolean) {
  TestBed.configureTestingModule({
    providers: [
      { provide: TeamApi, useValue: { team: vi.fn(() => of(TEAM)) } },
      { provide: AuthService, useValue: { canManageTeam: () => canManage } },
    ],
  });
  const fixture = TestBed.createComponent(TeamTab);
  await fixture.componentInstance.load();
  fixture.detectChanges();
  return fixture;
}

describe('TeamTab', () => {
  it('lists members and pending invitations, with actions for managers', async () => {
    const fixture = await render(true);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('aisha@example.com');
    expect(text).toContain('new@example.com');
    expect(fixture.nativeElement.querySelector('[data-test="invite"]')).not.toBeNull();
    // Only Chris can be removed: not the owner, not yourself.
    expect(fixture.nativeElement.querySelectorAll('[data-test="remove"]').length).toBe(1);
  });

  it('is read-only for members', async () => {
    const fixture = await render(false);
    expect(fixture.nativeElement.querySelector('[data-test="invite"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test="remove"]')).toBeNull();
  });
});
