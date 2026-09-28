import { HttpErrorResponse } from '@angular/common/http';

/** First Laravel validation message (422), otherwise the fallback — for snackbars. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && error.status === 422) {
    const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
    const first = Object.values(errors)[0]?.[0];
    if (first) {
      return first;
    }
  }
  return fallback;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 404;
}
