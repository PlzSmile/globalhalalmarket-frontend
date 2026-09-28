import { HttpErrorResponse } from '@angular/common/http';
import { errorMessage, isNotFound } from './error-message';
import { collapseSpaces, nameKey } from './normalise';

describe('errorMessage', () => {
  it('returns the first server validation message, else the fallback', () => {
    const e422 = new HttpErrorResponse({ status: 422, error: { errors: { name: ['You already have an ingredient called Sugar.'] } } });
    expect(errorMessage(e422, 'Fallback')).toBe('You already have an ingredient called Sugar.');
    expect(errorMessage(new HttpErrorResponse({ status: 500 }), 'Fallback')).toBe('Fallback');
    expect(errorMessage(new Error('x'), 'Fallback')).toBe('Fallback');
  });

  it('recognises 404', () => {
    expect(isNotFound(new HttpErrorResponse({ status: 404 }))).toBe(true);
    expect(isNotFound(new HttpErrorResponse({ status: 422 }))).toBe(false);
  });

  it('normalises names like the server', () => {
    expect(collapseSpaces('  Cocoa \t  Butter ')).toBe('Cocoa Butter');
    expect(nameKey('  COCOA   butter ')).toBe('cocoa butter');
  });
});
