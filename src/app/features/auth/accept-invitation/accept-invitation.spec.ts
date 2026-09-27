import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AcceptInvitation } from './accept-invitation';
import { TeamApi } from '../../../core/api/team-api';
import { AuthService } from '../../../core/auth/auth.service';
import { InvitationPreview } from '../../../core/models/auth';

function setup(preview: Observable<InvitationPreview>, loggedInAs: string | null = null) {
  const user = signal(loggedInAs ? { email: loggedInAs } : null);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: TeamApi, useValue: { previewInvitation: vi.fn(() => preview), acceptInvitation: vi.fn() } },
      { provide: AuthService, useValue: { user, setUser: vi.fn(), logout: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(AcceptInvitation);
  fixture.componentRef.setInput('token', 'a'.repeat(40));
  return fixture;
}

describe('AcceptInvitation', () => {
  it('shows company and role for a valid link', async () => {
    const fixture = setup(of({ company_name: 'Khan Foods', email: 'new@example.com', role: 'admin' as const }));
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Join Khan Foods as Admin');
  });

  it('explains when the link is invalid or expired', async () => {
    const fixture = setup(throwError(() => new HttpErrorResponse({ status: 404 })));
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('This invitation link is not valid or has expired');
  });

  it('asks a logged-in user to log out first instead of creating a second account', async () => {
    const fixture = setup(of({ company_name: 'Khan Foods', email: 'new@example.com', role: 'member' as const }), 'someone@else.com');
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("You're logged in as someone@else.com");
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });
});
