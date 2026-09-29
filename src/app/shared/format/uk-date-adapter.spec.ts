import { TestBed } from '@angular/core/testing';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { UkDateAdapter } from './uk-date-adapter';

describe('UkDateAdapter', () => {
  let adapter: UkDateAdapter;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [UkDateAdapter, { provide: MAT_DATE_LOCALE, useValue: 'en-GB' }] });
    adapter = TestBed.inject(UkDateAdapter);
  });

  it('reads typed dates day first (UK), never month first', () => {
    const date = adapter.parse('12/03/2027', null) as Date;
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2027, 2, 12]);
    const dashed = adapter.parse('1-6-2027', null) as Date;
    expect([dashed.getFullYear(), dashed.getMonth(), dashed.getDate()]).toEqual([2027, 5, 1]);
    const dotted = adapter.parse(' 31.12.2026 ', null) as Date;
    expect([dotted.getFullYear(), dotted.getMonth(), dotted.getDate()]).toEqual([2026, 11, 31]);
  });

  it('marks impossible or unclear dates as invalid instead of guessing', () => {
    for (const text of ['31/02/2027', '13/13/2027', '12/03/27', '2027-03-12x', 'next week']) {
      const parsed = adapter.parse(text, null);
      expect(parsed === null || !adapter.isValid(parsed as Date)).toBe(true);
    }
  });

  it('treats an empty field as no date and keeps real Date values', () => {
    expect(adapter.parse('', null)).toBeNull();
    const date = new Date(2027, 2, 12);
    expect((adapter.parse(date, null) as Date).getTime()).toBe(date.getTime());
  });

  it('shows dates day first', () => {
    expect(adapter.format(new Date(2027, 2, 12), { year: 'numeric', month: '2-digit', day: '2-digit' })).toBe('12/03/2027');
  });
});
