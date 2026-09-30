import { statusDetail } from './compliance-format';
import { ukDateTime } from '../../shared/format/uk-date';

describe('statusDetail', () => {
  const today = new Date(2026, 8, 30);

  it('shows the date and days left for amber, "valid until" for green, nothing otherwise', () => {
    expect(statusDetail('amber', '2026-10-13', today)).toBe('Expires 13 Oct 2026 · 13 days');
    expect(statusDetail('amber', '2026-10-01', today)).toBe('Expires 1 Oct 2026 · 1 day');
    expect(statusDetail('amber', '2026-09-30', today)).toBe('Expires 30 Sep 2026 · today');
    expect(statusDetail('green', '2027-06-01', today)).toBe('Valid until 1 Jun 2027');
    expect(statusDetail('green', null, today)).toBeNull();
    expect(statusDetail('red', null, today)).toBeNull();
    expect(statusDetail(null, null, today)).toBeNull();
  });

  it('formats a timestamp as a UK date and time', () => {
    expect(ukDateTime('2026-09-30T10:12:00')).toBe('30 Sep 2026, 10:12');
  });
});
