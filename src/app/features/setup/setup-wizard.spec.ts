import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MatIconRegistry } from '@angular/material/icon';
import { FakeMatIconRegistry } from '@angular/material/icon/testing';
import { SetupWizard } from './setup-wizard';
import { MeApi } from '../../core/api/me-api';
import { AuthService } from '../../core/auth/auth.service';
import { CompanyDetail, CurrentUser } from '../../core/models/auth';
import { settle } from '../../../testing/settle';

const owner: CurrentUser = { id: 1, name: 'A', email: 'a@khan.test', role: 'owner', email_verified: true, setup_required: true, two_factor_enabled: false, company: { id: 1, name: 'Khan Foods Ltd' } };
const company: CompanyDetail = { id: 1, name: 'Khan Foods Ltd', branding: { logo_url: null, contact_email: 'orders@khan.test', phone: '+44 113 496 0000', website: null, address: null } };

function setup(user: CurrentUser, completeSetup = vi.fn(() => of(company))) {
  const refresh = vi.fn().mockResolvedValue({ ...user, setup_required: false });
  TestBed.configureTestingModule({
    imports: [SetupWizard],
    providers: [
      provideRouter([]),
      { provide: MeApi, useValue: { company: () => of(company), completeSetup } },
      { provide: AuthService, useValue: { user: () => user, refresh, setUser: vi.fn(), logout: vi.fn() } },
      { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
    ],
  });
  const fixture = TestBed.createComponent(SetupWizard);
  return { fixture, completeSetup, refresh };
}

describe('SetupWizard', () => {
  it('starts with the authenticator app when it is not on yet', async () => {
    const { fixture } = setup(owner);
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[aria-current="step"]')?.textContent).toContain('Security');
    expect(el.textContent).toContain('Set up the authenticator app');
    expect(el.querySelectorAll('.steps__item--done').length).toBe(1); // the email is already confirmed
  });

  it('skips to the company step when the app is already on, then finishes without an email preview', async () => {
    const { fixture, completeSetup, refresh } = setup({ ...owner, two_factor_enabled: true });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await settle(fixture);
    expect(fixture.componentInstance.step()).toBe('company');

    fixture.componentInstance.companySaved(company);
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('You are all set');
    expect(el.textContent).toContain('Khan Foods Ltd');
    expect(el.querySelector('.preview')).toBeNull();

    await fixture.componentInstance.finish();
    expect(completeSetup).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('goes back to the security step when the server says the app is not on', async () => {
    const error = new HttpErrorResponse({ status: 422, error: { code: 'two_factor_required' } });
    const { fixture } = setup({ ...owner, two_factor_enabled: true }, vi.fn(() => throwError(() => error)));
    await settle(fixture);
    await fixture.componentInstance.finish();
    expect(fixture.componentInstance.step()).toBe('security');
  });
});
