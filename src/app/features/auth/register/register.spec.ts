import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { Register } from './register';
import { AuthService } from '../../../core/auth/auth.service';
import { PromoApi } from '../../../core/api/promo-api';
import { Promo } from '../../../core/models/promo';

const DETAILS = { name: 'Aisha Khan', email: 'a@khan.test', password: 'a-strong-password-1', password_confirmation: 'a-strong-password-1', company_name: 'Khan Foods' };

function render(query: Record<string, string> = {}, promo: Promo | null = null) {
  const auth = { register: vi.fn().mockResolvedValue(undefined) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      { provide: PromoApi, useValue: { current: () => of(promo) } },
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

  it('shows the current promotion and fills in its code on request', () => {
    const { fixture, form } = render({}, { text: 'Spring promo: 3 months of Pro free with code SPRING26', code: 'SPRING26' });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Spring promo: 3 months of Pro free with code SPRING26');

    (el.querySelector('[data-test="use-promo"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(form.controls.offer_code.value).toBe('SPRING26');
    expect(el.querySelector('[data-test="use-promo"]')).toBeNull(); // nothing left to do
  });

  it('shows no promotion note when there is none', () => {
    const { fixture } = render();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-test="promo"]')).toBeNull();
  });
});
