import { FormControl, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { applyServerErrors, clearServerErrors, serverError } from './server-errors';

describe('applyServerErrors', () => {
  it('puts Laravel 422 messages on the matching controls', () => {
    const form = new FormGroup({ email: new FormControl('a@b.com'), password: new FormControl('x') });
    const error = new HttpErrorResponse({ status: 422, error: { message: 'Invalid', errors: { email: ['These credentials do not match our records.'] } } });

    expect(applyServerErrors(form, error)).toBeNull();
    expect(serverError(form.controls.email)).toBe('These credentials do not match our records.');
    expect(form.controls.email.touched).toBe(true);
  });

  it('clearServerErrors removes only server messages, keeping client validation', () => {
    const form = new FormGroup({ email: new FormControl('a@b.com'), name: new FormControl('', Validators.required) });
    applyServerErrors(form, new HttpErrorResponse({ status: 422, error: { errors: { email: ['Nope.'] } } }));
    expect(form.valid).toBe(false);

    clearServerErrors(form);

    expect(serverError(form.controls.email)).toBeNull();
    expect(form.controls.email.valid).toBe(true);
    expect(form.controls.name.hasError('required')).toBe(true);
  });

  it('returns messages that belong to no control, and ignores non-422 errors', () => {
    const form = new FormGroup({ name: new FormControl('') });
    const error = new HttpErrorResponse({ status: 422, error: { errors: { email: ['Already taken.'] } } });
    expect(applyServerErrors(form, error)).toBe('Already taken.');
    expect(applyServerErrors(form, new HttpErrorResponse({ status: 500 }))).toBeNull();
  });
});
