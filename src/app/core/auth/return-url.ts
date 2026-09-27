const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/invitation'];

/** Only same-app paths are allowed after login (prevents open redirects like //evil.example). */
export function safeReturnUrl(url: string | null): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) {
    return '/dashboard';
  }
  return AUTH_PAGES.some((page) => url === page || url.startsWith(`${page}?`) || url.startsWith(`${page}/`)) ? '/dashboard' : url;
}
