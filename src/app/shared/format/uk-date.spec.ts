import { daysUntil, expiryNote, fileSize, fromIsoDate, toIsoDate, ukDate } from './uk-date';

describe('uk-date helpers', () => {
  const today = new Date(2026, 8, 28); // 28 Sep 2026

  it('formats ISO dates the UK way', () => {
    expect(ukDate('2027-03-12')).toBe('12 Mar 2027');
    expect(ukDate(null)).toBe('');
  });

  it('counts days and explains expiry', () => {
    expect(daysUntil('2026-10-08', today)).toBe(10);
    expect(expiryNote('2026-09-27', today)).toEqual({ tone: 'danger', text: 'Expired' });
    expect(expiryNote('2026-09-29', today)).toEqual({ tone: 'warning', text: 'Expires in 1 day' });
    expect(expiryNote('2026-11-01', today)).toEqual({ tone: 'warning', text: 'Expires in 34 days' });
    expect(expiryNote('2027-09-28', today)).toEqual({ tone: null, text: null });
  });

  it('converts dates without timezone shifts and formats sizes', () => {
    expect(toIsoDate(new Date(2027, 0, 5))).toBe('2027-01-05');
    expect(fromIsoDate('2027-01-05')?.getDate()).toBe(5);
    expect(fromIsoDate(null)).toBeNull();
    expect(fileSize(2048)).toBe('2 KB');
    expect(fileSize(3.5 * 1024 * 1024)).toBe('3.5 MB');
  });
});
