import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ResetPassword } from './reset-password';
import { AuthApi } from '../../../core/api/auth-api';

describe('ResetPassword', () => {
  it('sends token + email from the link and goes to login', async () => {
    const api = { resetPassword: vi.fn(() => of({ message: 'ok' })) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthApi, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ token: 'tok', email: 'a@example.com' }) } } },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.componentInstance['form'].setValue({ password: 'a-brand-new-password', password_confirmation: 'a-brand-new-password' });

    await fixture.componentInstance.submit();

    expect(api.resetPassword).toHaveBeenCalledWith({
      token: 'tok', email: 'a@example.com', password: 'a-brand-new-password', password_confirmation: 'a-brand-new-password',
    });
    expect(navigate).toHaveBeenCalledWith('/login?reset=1');
  });

  it('shows a server password message under the field, not "link expired"', async () => {
    const breached = 'The given password has appeared in a data leak. Please choose a different password.';
    const api = { resetPassword: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { password: [breached] } } }))) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthApi, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ token: 'tok', email: 'a@example.com' }) } } },
      ],
    });
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    fixture.componentInstance['form'].setValue({ password: 'password-password', password_confirmation: 'password-password' });

    await fixture.componentInstance.submit();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain(breached);
    expect(text).not.toContain('not valid or has expired');
  });
});
