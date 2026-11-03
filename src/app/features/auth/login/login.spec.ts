import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Login } from './login';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthApi } from '../../../core/api/auth-api';

const EMAIL_CHALLENGE = { two_factor: true, method: 'email', email_hint: 'a•••@example.com', resend_after: 30 };
const APP_CHALLENGE = { ...EMAIL_CHALLENGE, method: 'app', resend_after: 0 };

describe('Login', () => {
  const auth = { login: vi.fn(), verifyLogin: vi.fn() };
  const api = { loginEmailCode: vi.fn() };

  beforeEach(() => {
    auth.login.mockReset();
    auth.verifyLogin.mockReset();
    api.loginEmailCode.mockReset();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: auth }, { provide: AuthApi, useValue: api }] });
  });

  function filled() {
    const fixture = TestBed.createComponent(Login);
    fixture.componentInstance['form'].setValue({ email: 'a@example.com', password: 'secret-secret', remember: true });
    return fixture;
  }

  it('does not submit an invalid form', async () => {
    const fixture = TestBed.createComponent(Login);
    await fixture.componentInstance.submit();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('after the password asks for the emailed code, then logs in and goes to the dashboard', async () => {
    auth.login.mockResolvedValue(EMAIL_CHALLENGE);
    auth.verifyLogin.mockResolvedValue({ email_verified: true });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = filled();

    await fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(auth.login).toHaveBeenCalledWith({ email: 'a@example.com', password: 'secret-secret', remember: true });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('We sent a 6-digit code to a•••@example.com');
    expect(navigate).not.toHaveBeenCalled();

    await fixture.componentInstance.verify('123456'); // what the boxes do once six digits are in
    expect(auth.verifyLogin).toHaveBeenCalledWith('123456', 'email');
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('with an authenticator app asks for its code and offers an email code instead', async () => {
    auth.login.mockResolvedValue(APP_CHALLENGE);
    api.loginEmailCode.mockReturnValue(of({ email_hint: 'a•••@example.com', resend_after: 30 }));
    const fixture = filled();
    await fixture.componentInstance.submit();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Enter the app code');

    (el.querySelector('[data-test="use-email"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(api.loginEmailCode).toHaveBeenCalled();
    expect(el.textContent).toContain('Check your email');
  });

  it('a wrong code shows the reason and stays on the code step', async () => {
    auth.login.mockResolvedValue(EMAIL_CHALLENGE);
    auth.verifyLogin.mockRejectedValue(new HttpErrorResponse({ status: 422, error: { errors: { code: ['That code is not right, or it has expired.'] } } }));
    const fixture = filled();
    await fixture.componentInstance.submit();

    await fixture.componentInstance.verify('000000');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-test="code-error"]')?.textContent).toContain('That code is not right');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-test="code-step"]')).not.toBeNull();
  });

  it('too many wrong codes go back to the password with the message', async () => {
    auth.login.mockResolvedValue(EMAIL_CHALLENGE);
    auth.verifyLogin.mockRejectedValue(new HttpErrorResponse({ status: 422, error: { errors: { login: ['Too many wrong codes. Please log in again.'] } } }));
    const fixture = filled();
    await fixture.componentInstance.submit();

    await fixture.componentInstance.verify('000000');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-test="code-step"]')).toBeNull();
    expect(el.textContent).toContain('Too many wrong codes');
  });

  it('can submit again after a wrong password (the old server error does not block the form)', async () => {
    auth.login
      .mockRejectedValueOnce(new HttpErrorResponse({ status: 422, error: { errors: { email: ['These credentials do not match our records.'] } } }))
      .mockResolvedValueOnce(EMAIL_CHALLENGE);
    const fixture = TestBed.createComponent(Login);
    const form = fixture.componentInstance['form'];
    form.setValue({ email: 'a@example.com', password: 'wrong-password', remember: false });
    await fixture.componentInstance.submit();

    form.controls.password.setValue('right-password');
    await fixture.componentInstance.submit();

    expect(auth.login).toHaveBeenCalledTimes(2);
  });

  it('sends unverified users to verify-email after the code', async () => {
    auth.login.mockResolvedValue(EMAIL_CHALLENGE);
    auth.verifyLogin.mockResolvedValue({ email_verified: false });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = filled();
    await fixture.componentInstance.submit();

    await fixture.componentInstance.verify('123456');

    expect(navigate).toHaveBeenCalledWith('/verify-email');
  });
});
