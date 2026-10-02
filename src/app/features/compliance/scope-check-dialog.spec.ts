import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ScopeCheckDialog } from './scope-check-dialog';
import { CertificatesApi } from '../../core/api/certificates-api';
import { settle } from '../../../testing/settle';

function setup(setScopeCheck = vi.fn(() => of({ result: 'covers', note: 'Page 2', by: 'Ana', at: 'now' }))) {
  const ref = { close: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { certificateId: 9, authorityCode: 'BPJPH', authority: 'BPJPH', current: null } },
      { provide: MatDialogRef, useValue: ref },
      { provide: CertificatesApi, useValue: { setScopeCheck } },
    ],
  });
  const fixture = TestBed.createComponent(ScopeCheckDialog);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dialog = fixture.componentInstance as unknown as Record<string, any>;
  return { fixture, dialog, ref, setScopeCheck, el: fixture.nativeElement as HTMLElement };
}

describe('ScopeCheckDialog', () => {
  it('requires a choice before saving', async () => {
    const { fixture, dialog, setScopeCheck, el } = setup();
    await settle(fixture);
    await dialog['submit']();
    await settle(fixture);
    expect(setScopeCheck).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Choose covers or does not cover.');
  });

  it('saves the decision with a tidied note and closes with it', async () => {
    const { fixture, dialog, setScopeCheck, ref } = setup();
    await settle(fixture);
    dialog['form'].setValue({ result: 'covers', note: '  Page   2 ' });
    await dialog['submit']();
    expect(setScopeCheck).toHaveBeenCalledWith(9, 'BPJPH', 'covers', 'Page 2');
    expect(ref.close).toHaveBeenCalledWith(expect.objectContaining({ result: 'covers' }));
  });

  it('shows the server message when saving fails', async () => {
    const failing = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'This certificate is archived. Restore it first.' } })));
    const { fixture, dialog, el } = setup(failing);
    await settle(fixture);
    dialog['form'].setValue({ result: 'not_covered', note: '' });
    await dialog['submit']();
    await settle(fixture);
    expect(failing).toHaveBeenCalledWith(9, 'BPJPH', 'not_covered', null);
    expect(el.textContent).toContain('This certificate is archived. Restore it first.');
  });
});
