import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Same rule as the backend (Password::defaults: min 12). */
export const PASSWORD_MIN = 12;

/** Confirmation fields: must equal the sibling control (re-validate it when the other field changes). */
export function matchesField(otherField: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const other = control.parent?.get(otherField);
    return other && control.value && control.value !== other.value ? { mismatch: true } : null;
  };
}
