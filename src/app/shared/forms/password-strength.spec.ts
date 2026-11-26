import { passwordChecks } from './password-strength';

describe('passwordChecks', () => {
  it('is empty, then short under 12 characters', () => {
    expect(passwordChecks('').strength).toBe('empty');
    const short = passwordChecks('Abc1!');
    expect(short.strength).toBe('short');
    expect(short.longEnough).toBe(false);
    expect(short.length).toBe(5);
  });

  it('accepts 12 characters without forcing capitals or numbers', () => {
    const c = passwordChecks('orchardlemon');
    expect(c.longEnough).toBe(true);
    expect(c.strength).toBe('fair');
    expect(c.hasUpper).toBe(false);
    expect(c.hasNumberOrSymbol).toBe(false);
  });

  it('rises with a mix of character types and with length', () => {
    expect(passwordChecks('Orchard7lemon').strength).toBe('good');
    expect(passwordChecks('Orchard 7 lemon trees').strength).toBe('strong');
    expect(passwordChecks('quiet orchard lemon trees').strength).toBe('strong'); // a long passphrase is strong without symbols
  });

  it('spots capitals, small letters and numbers or symbols', () => {
    const c = passwordChecks('Dates&Figs');
    expect([c.hasUpper, c.hasLower, c.hasNumberOrSymbol]).toEqual([true, true, true]);
  });

  it('keeps common patterns at fair however long', () => {
    expect(passwordChecks('Password123456789!').strength).toBe('fair');
    expect(passwordChecks('aaaaaaaaaaaaaaaa').strength).toBe('fair');
  });
});
