const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/invitation'];

/** Only same-app paths are allowed after login (prevents open redirects like //evil.example). */
export function safeReturnUrl(url: string | null): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) {
    return '/dashboard';
  }
  return AUTH_PAGES.some((page) => url === page || url.startsWith(`${page}?`) || url.startsWith(`${page}/`)) ? '/dashboard' : url;
}

/**
 * Query params for the login link: none when the person was heading to the dashboard anyway (the default after
 * login), so the address stays a clean /app/login (Bilal, 11 Nov 2026).
 */
export function returnUrlParams(url: string): { returnUrl?: string } {
  const target = safeReturnUrl(url);
  return target === '/dashboard' || target === '/' ? {} : { returnUrl: target };
}
