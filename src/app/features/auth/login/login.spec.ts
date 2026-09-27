import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Login } from './login';
import { AuthService } from '../../../core/auth/auth.service';

describe('Login', () => {
  const auth = { login: vi.fn() };

  beforeEach(() => {
    auth.login.mockReset();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: auth }] });
  });

  it('does not submit an invalid form', async () => {
    const fixture = TestBed.createComponent(Login);
    await fixture.componentInstance.submit();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('logs in and goes to the dashboard', async () => {
    auth.login.mockResolvedValue({ email_verified: true });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Login);
    fixture.componentInstance['form'].setValue({ email: 'a@example.com', password: 'secret-secret', remember: true });

    await fixture.componentInstance.submit();

    expect(auth.login).toHaveBeenCalledWith({ email: 'a@example.com', password: 'secret-secret', remember: true });
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('sends unverified users to verify-email', async () => {
    auth.login.mockResolvedValue({ email_verified: false });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Login);
    fixture.componentInstance['form'].setValue({ email: 'a@example.com', password: 'secret-secret', remember: false });

    await fixture.componentInstance.submit();

    expect(navigate).toHaveBeenCalledWith('/verify-email');
  });
});
