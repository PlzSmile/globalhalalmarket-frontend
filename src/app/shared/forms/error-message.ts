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

/** Why an action (role change, remove, resend, …) failed, in words the user can act on — for snackbars. */
export function actionError(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    switch (error.status) {
      case 0: return 'We could not reach the server. Check your connection and try again.';
      case 403: return 'You do not have permission to do that. Ask an owner or admin.';
      case 404: return 'Someone else changed or removed this a moment ago. The list has been refreshed.';
      case 422: return errorMessage(error, fallback);
    }
  }
  return fallback;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 404;
}
