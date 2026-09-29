import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CatalogueImport } from './catalogue-import';
import { ImportsApi } from '../../core/api/imports-api';
import { AuthService } from '../../core/auth/auth.service';
import { ImportPreview } from '../../core/models/imports';
import { settle } from '../../../testing/settle';

const COUNTS = { products: { create: 12, reuse: 3 }, ingredients: { create: 40, reuse: 5 }, suppliers: { create: 8, reuse: 2, fill: 1 }, links: { add: 38, existing: 2 } };
const OK: ImportPreview = { fingerprint: 'f1', counts: COUNTS, warnings: [{ row: 4, message: 'Acme already has an email; the file\'s value was ignored.' }], errors: [], errors_total: 0, can_import: true };
const BAD: ImportPreview = { ...OK, errors: [{ row: 14, column: 'supplier_email', message: 'Enter a valid email address.' }], errors_total: 4, can_import: false };
const csv = (name = 'c.csv') => new File(['product_name,ingredient\nA,B\n'], name, { type: 'text/csv' });

function setup(api: Record<string, unknown> = {}, canManage = true) {
  const imports = { templateUrl: '/api/v1/imports/catalogue/template', preview: vi.fn(() => of(OK)), import: vi.fn(() => of({ counts: COUNTS })), ...api };
  const snackBar = { open: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ImportsApi, useValue: imports },
      { provide: AuthService, useValue: { canManageTeam: () => canManage } },
      { provide: MatSnackBar, useValue: snackBar },
    ],
  });
  const fixture = TestBed.createComponent(CatalogueImport);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const page = fixture.componentInstance as unknown as Record<string, any>;
  return { fixture, page, imports, snackBar, el: fixture.nativeElement as HTMLElement };
}

describe('CatalogueImport', () => {
  it('tells members that only owners and admins can import', async () => {
    const { fixture, el } = setup({}, false);
    await settle(fixture);
    expect(el.querySelector('[data-test="not-allowed"]')?.textContent).toContain('Only owners and admins can import.');
    expect(el.querySelector('hs-file-picker')).toBeNull();
  });

  it('offers the template and previews a chosen file', async () => {
    const { fixture, page, imports, el } = setup();
    await settle(fixture);
    expect(el.querySelector('[data-test="template"]')?.getAttribute('href')).toBe('/api/v1/imports/catalogue/template');

    const file = csv();
    await page['onFile'](file);
    await settle(fixture);
    expect(imports.preview).toHaveBeenCalledWith(file);
    expect(el.querySelector('[data-test="summary"]')?.textContent).toContain('Products: 12 new, 3 existing');
    expect(el.querySelector('[data-test="summary"]')?.textContent).toContain('Suppliers: 8 new, 2 existing (1 updated)');
    expect(el.querySelector('[data-test="warnings"]')?.textContent).toContain('1 warning');
    expect((el.querySelector('[data-test="run-import"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('imports with the fingerprint and shows the result', async () => {
    const { fixture, page, imports, snackBar, el } = setup();
    await settle(fixture);
    const file = csv();
    await page['onFile'](file);
    await page['runImport']();
    await settle(fixture);
    expect(imports.import).toHaveBeenCalledWith(file, 'f1');
    expect(snackBar.open).toHaveBeenCalledWith('Import finished.', 'Close', { duration: 4000 });
    expect(el.querySelector('[data-test="result"]')?.textContent).toContain('Products: 12 new');
  });

  it('lists row errors, blocks the import and says how many more there are', async () => {
    const { fixture, page, imports, el } = setup({ preview: vi.fn(() => of(BAD)) });
    await settle(fixture);
    await page['onFile'](csv());
    await settle(fixture);
    const errors = el.querySelector('[data-test="errors"]')?.textContent ?? '';
    expect(errors).toContain('Fix these rows in your file and choose it again.');
    expect(errors).toContain('Row 14');
    expect(errors).toContain('supplier_email');
    expect(errors).toContain('Enter a valid email address.');
    expect(errors).toContain('and 3 more');
    expect((el.querySelector('[data-test="run-import"]') as HTMLButtonElement).disabled).toBe(true);
    await page['runImport']();
    expect(imports.import).not.toHaveBeenCalled();
  });

  it('shows new row errors found at import time, and the file-changed message', async () => {
    const rowErrors = new HttpErrorResponse({ status: 422, error: { message: 'Some rows need fixing. Nothing was imported.', data: BAD } });
    const first = setup({ import: vi.fn(() => throwError(() => rowErrors)) });
    await settle(first.fixture);
    await first.page['onFile'](csv());
    await first.page['runImport']();
    await settle(first.fixture);
    expect(first.el.querySelector('[data-test="errors"]')?.textContent).toContain('Row 14');

    TestBed.resetTestingModule();
    const changed = new HttpErrorResponse({ status: 422, error: { message: 'x', errors: { fingerprint: ['The file changed since the preview. Please preview it again.'] } } });
    const second = setup({ import: vi.fn(() => throwError(() => changed)) });
    await settle(second.fixture);
    await second.page['onFile'](csv());
    await second.page['runImport']();
    await settle(second.fixture);
    expect(second.el.querySelector('[data-test="form-error"]')?.textContent).toContain('The file changed since the preview. Please choose it again.');
  });

  it('shows file problems from the server', async () => {
    const bad = new HttpErrorResponse({ status: 422, error: { message: 'x', errors: { file: ['The required column "ingredient" is missing.'] } } });
    const { fixture, page, el } = setup({ preview: vi.fn(() => throwError(() => bad)) });
    await settle(fixture);
    await page['onFile'](csv());
    await settle(fixture);
    expect(el.querySelector('[data-test="form-error"]')?.textContent).toContain('The required column "ingredient" is missing.');
  });

  it('ignores a slow preview for an older file', async () => {
    const older = new Subject<ImportPreview>();
    const newer = new Subject<ImportPreview>();
    const preview = vi.fn().mockReturnValueOnce(older.asObservable()).mockReturnValueOnce(newer.asObservable());
    const { fixture, page } = setup({ preview });
    await settle(fixture);
    const first = page['onFile'](csv('old.csv'));
    const second = page['onFile'](csv('new.csv'));
    newer.next({ ...OK, fingerprint: 'new' });
    newer.complete();
    older.next({ ...OK, fingerprint: 'old' });
    older.complete();
    await Promise.all([first, second]);
    expect(page['preview']()?.fingerprint).toBe('new');
  });

  it('starts again with "Choose another file"', async () => {
    const { fixture, page } = setup();
    await settle(fixture);
    await page['onFile'](csv());
    page['reset']();
    await settle(fixture);
    expect(page['preview']()).toBeNull();
    expect(page['result']()).toBeNull();
  });

  it('keeps "Choose another file" disabled while the import runs', async () => {
    const pending = new Subject<{ counts: typeof COUNTS }>();
    const { fixture, page, el } = setup({ import: vi.fn(() => pending.asObservable()) });
    await settle(fixture);
    await page['onFile'](csv());
    const running = page['runImport']();
    fixture.detectChanges();
    const again = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Choose another file')) as HTMLButtonElement;
    expect(again.disabled).toBe(true);
    pending.next({ counts: COUNTS });
    pending.complete();
    await running;
  });

  it('shows warnings that were found at import time on the result card', async () => {
    const { fixture, page, el } = setup({ import: vi.fn(() => of({ counts: COUNTS, warnings: [{ row: 7, message: 'Acme already has an email; the file\'s value was ignored.' }] })) });
    await settle(fixture);
    await page['onFile'](csv());
    await page['runImport']();
    await settle(fixture);
    expect(el.querySelector('[data-test="result-warnings"]')?.textContent).toContain('Row 7: Acme already has an email');
  });
});
