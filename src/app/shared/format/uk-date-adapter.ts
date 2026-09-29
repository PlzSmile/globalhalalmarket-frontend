import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

/**
 * Material's NativeDateAdapter reads typed dates with Date.parse, which is month-first ("12/03/2027" → 3 Dec).
 * UK users type day-first, so typed text is read as DD/MM/YYYY (separators / - .), and anything else is invalid
 * rather than guessed. Dates picked from the calendar are unaffected.
 */
@Injectable()
export class UkDateAdapter extends NativeDateAdapter {
  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value !== 'string') {
      return super.parse(value, parseFormat);
    }
    const text = value.trim();
    if (text === '') {
      return null;
    }

    const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
    if (!match) {
      return this.invalid();
    }
    const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const date = new Date(year, month - 1, day);
    // Rejects overflow such as 31/02 (which Date would roll into March).
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : this.invalid();
  }
}
