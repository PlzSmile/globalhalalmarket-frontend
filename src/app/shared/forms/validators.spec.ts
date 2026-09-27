import { FormControl, FormGroup, Validators } from '@angular/forms';
import { PASSWORD_MIN, matchesField } from './validators';

describe('matchesField', () => {
  it('flags a confirmation that differs from the password', () => {
    const form = new FormGroup({
      password: new FormControl('correct-horse-battery', [Validators.minLength(PASSWORD_MIN)]),
      password_confirmation: new FormControl('different', [matchesField('password')]),
    });
    form.controls.password_confirmation.updateValueAndValidity();
    expect(form.controls.password_confirmation.hasError('mismatch')).toBe(true);

    form.controls.password_confirmation.setValue('correct-horse-battery');
    expect(form.controls.password_confirmation.valid).toBe(true);
    expect(PASSWORD_MIN).toBe(12);
  });
});
