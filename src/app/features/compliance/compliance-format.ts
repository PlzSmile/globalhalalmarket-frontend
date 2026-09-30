import { ComplianceStatus } from '../../core/models/compliance';
import { daysUntil, ukDate } from '../../shared/format/uk-date';

/** Small line under a badge: amber is still valid, so say until when; green shows its next expiry. */
export function statusDetail(status: ComplianceStatus | null, nextExpiry: string | null, today: Date = new Date()): string | null {
  if (!status || !nextExpiry || status === 'red') {
    return null;
  }
  if (status === 'green') {
    return `Valid until ${ukDate(nextExpiry)}`;
  }
  const days = daysUntil(nextExpiry, today);
  return `Expires ${ukDate(nextExpiry)} · ${days <= 0 ? 'today' : `${days} ${days === 1 ? 'day' : 'days'}`}`;
}
