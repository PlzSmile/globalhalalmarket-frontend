const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(iso: string): [number, number, number] | null {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return y && m && d ? [y, m, d] : null;
}

/** "2027-03-12" → "12 Mar 2027". */
export function ukDate(iso: string | null | undefined): string {
  const p = iso ? parts(iso) : null;
  return p ? `${p[2]} ${MONTHS[p[1] - 1]} ${p[0]}` : '';
}

/** Whole days from today to the date (negative when past). */
export function daysUntil(iso: string, today: Date = new Date()): number {
  const p = parts(iso);
  if (!p) {
    return 0;
  }
  const target = Date.UTC(p[0], p[1] - 1, p[2]);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - now) / 86_400_000);
}

export function expiryNote(iso: string, today: Date = new Date()): { tone: 'danger' | 'warning' | null; text: string | null } {
  const days = daysUntil(iso, today);
  if (days < 0) {
    return { tone: 'danger', text: 'Expired' };
  }
  if (days === 0) {
    return { tone: 'danger', text: 'Expires today' };
  }
  if (days <= 60) {
    return { tone: 'warning', text: `Expires in ${days} ${days === 1 ? 'day' : 'days'}` };
  }
  return { tone: null, text: null };
}

/** Local date → "YYYY-MM-DD" (no timezone shift). */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromIsoDate(iso: string | null | undefined): Date | null {
  const p = iso ? parts(iso) : null;
  return p ? new Date(p[0], p[1] - 1, p[2]) : null;
}

export function fileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** ISO timestamp → "30 Sep 2026, 10:12" in the browser's time zone. */
export function ukDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return Number.isNaN(date.getTime()) ? '' : `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
