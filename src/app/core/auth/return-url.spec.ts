import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('keeps in-app paths', () => {
    expect(safeReturnUrl('/settings?tab=team')).toBe('/settings?tab=team');
  });

  it('falls back to the dashboard for missing, external or protocol-relative URLs', () => {
    expect(safeReturnUrl(null)).toBe('/dashboard');
    expect(safeReturnUrl('')).toBe('/dashboard');
    expect(safeReturnUrl('https://evil.example')).toBe('/dashboard');
    expect(safeReturnUrl('//evil.example')).toBe('/dashboard');
    expect(safeReturnUrl('/\\evil.example')).toBe('/dashboard');
    expect(safeReturnUrl('/login')).toBe('/dashboard');
  });
});
