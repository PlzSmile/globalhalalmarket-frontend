import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Register } from './register';
import { AuthService } from '../../../core/auth/auth.service';

const DETAILS = { name: 'Aisha Khan', email: 'a@khan.test', password: 'a-strong-password-1', password_confirmation: 'a-strong-password-1', company_name: 'Khan Foods' };

function render(query: Record<string, string> = {}) {
  const auth = { register: vi.fn().mockResolvedValue(undefined) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
    ],
  });
  vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(Register);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { auth, fixture, form: (fixture.componentInstance as unknown as Record<string, any>)['form'] };
}

describe('Register', () => {
  it('fills the offer code from an ?offer= link and sends it', async () => {
    const { auth, fixture, form } = render({ offer: 'launch15' });
    expect(form.controls.offer_code.value).toBe('LAUNCH15');

    form.patchValue(DETAILS);
    await fixture.componentInstance.submit();

    expect(auth.register).toHaveBeenCalledWith({ ...DETAILS, offer_code: 'LAUNCH15' });
  });

  it('leaves the code out when there is none', async () => {
    const { auth, fixture, form } = render();
    form.patchValue(DETAILS);
    await fixture.componentInstance.submit();

    expect(auth.register).toHaveBeenCalledWith(DETAILS);
  });

  it('has an optional offer code field', () => {
    const { fixture } = render();
    expect((fixture.nativeElement as HTMLElement).querySelector('input[formcontrolname="offer_code"]')).not.toBeNull();
  });
});
