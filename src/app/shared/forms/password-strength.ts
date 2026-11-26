import { PASSWORD_MIN } from './validators';

/**
 * 18 Nov 2026 (Bilal): live password checks while typing. Length is the only hard rule (OWASP ASVS L2 and NCSC:
 * at least 12, no forced character rules); capitals, small letters and numbers or symbols are shown as tips that
 * make the strength bar rise. The server also rejects passwords found in known data leaks.
 */
export type PasswordStrength = 'empty' | 'short' | 'fair' | 'good' | 'strong';

export interface PasswordChecks {
  length: number;
  longEnough: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumberOrSymbol: boolean;
  strength: PasswordStrength;
}

/** Common patterns that make a long password easy to guess. */
const WEAK = /^(.)\1+$|password|qwerty|letmein|welcome|admin|12345|abcdef/i;

export function passwordChecks(password: string): PasswordChecks {
  const length = [...password].length;
  const hasUpper = /\p{Lu}/u.test(password);
  const hasLower = /\p{Ll}/u.test(password);
  const hasNumberOrSymbol = /[^\p{L}\s]/u.test(password);
  const longEnough = length >= PASSWORD_MIN;
  return { length, longEnough, hasUpper, hasLower, hasNumberOrSymbol, strength: strength(password, length, longEnough, hasUpper, hasLower, hasNumberOrSymbol) };
}

function strength(password: string, length: number, longEnough: boolean, upper: boolean, lower: boolean, other: boolean): PasswordStrength {
  if (length === 0) return 'empty';
  if (!longEnough) return 'short';
  if (WEAK.test(password)) return 'fair';
  const mix = [upper, lower, other].filter(Boolean).length;
  const points = (length >= 16 ? 1 : 0) + (length >= 20 ? 1 : 0) + (mix === 3 ? 1 : 0);
  return points === 0 ? 'fair' : points === 1 ? 'good' : 'strong';
}
