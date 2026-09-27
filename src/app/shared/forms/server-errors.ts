import { AbstractControl, FormGroup } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

/**
 * Shows Laravel 422 validation messages under the matching form fields.
 * Returns the first message that has no matching field (show it above the form), otherwise null.
 */
export function applyServerErrors(form: FormGroup, error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 422) {
    return null;
  }

  const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
  let unmatched: string | null = null;

  for (const [field, messages] of Object.entries(errors)) {
    const control = form.get(field);
    if (control) {
      control.setErrors({ ...(control.errors ?? {}), server: messages[0] });
      control.markAsTouched();
    } else {
      unmatched ??= messages[0];
    }
  }

  return unmatched;
}

/** Call at the start of every submit: old server messages must not keep a corrected form invalid. */
export function clearServerErrors(form: FormGroup): void {
  for (const control of Object.values(form.controls)) {
    if (control.hasError('server')) {
      const { server: _removed, ...rest } = control.errors ?? {};
      control.setErrors(Object.keys(rest).length ? rest : null);
      control.updateValueAndValidity({ emitEvent: false });
    }
  }
}

export function serverError(control: AbstractControl | null): string | null {
  return (control?.errors?.['server'] as string | undefined) ?? null;
}
