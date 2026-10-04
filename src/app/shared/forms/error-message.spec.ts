import { HttpErrorResponse } from '@angular/common/http';
import { errorMessage, isNotFound } from './error-message';
import { collapseSpaces, nameKey } from './normalise';
import { actionError } from './error-message';

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

  it('explains a failed action: no permission, already changed, offline, server message', () => {
    const fail = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });
    expect(actionError(fail(403), 'X')).toBe('You do not have permission to do that. Ask an owner or admin.');
    expect(actionError(fail(404), 'X')).toBe('Someone else changed or removed this a moment ago. The list has been refreshed.');
    expect(actionError(fail(0), 'X')).toBe('We could not reach the server. Check your connection and try again.');
    expect(actionError(fail(422, { errors: { role: ['The owner cannot be changed.'] } }), 'X')).toBe('The owner cannot be changed.');
    expect(actionError(fail(500), 'Something went wrong.')).toBe('Something went wrong.');
  });
});
