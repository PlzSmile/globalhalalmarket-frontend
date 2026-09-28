import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NameDialog, NameDialogData } from './name-dialog';

function render(save: NameDialogData['save']) {
  const close = vi.fn();
  const data: NameDialogData = { title: 'Rename ingredient', label: 'Name', value: 'Gelatin', maxLength: 120, save };
  TestBed.configureTestingModule({
    providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close } }],
  });
  const fixture = TestBed.createComponent(NameDialog);
  fixture.detectChanges();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { fixture, close, dialog: fixture.componentInstance as unknown as Record<string, any> };
}

describe('NameDialog', () => {
  it('saves the tidied name and closes with true', async () => {
    const save = vi.fn(() => of({}));
    const { close, dialog } = render(save);
    dialog['form'].controls.name.setValue('  Beef   gelatin ');
    await dialog['save']();
    expect(save).toHaveBeenCalledWith('Beef gelatin');
    expect(close).toHaveBeenCalledWith(true);
  });

  it('shows the server message and stays open', async () => {
    const error = new HttpErrorResponse({ status: 422, error: { errors: { name: ['You already have an ingredient called Sugar.'] } } });
    const { fixture, close, dialog } = render(vi.fn(() => throwError(() => error)));
    dialog['form'].controls.name.setValue('Sugar');
    await dialog['save']();
    fixture.detectChanges();
    expect(close).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('You already have an ingredient called Sugar.');
  });

  it('requires a name', async () => {
    const save = vi.fn(() => of({}));
    const { dialog } = render(save);
    dialog['form'].controls.name.setValue('   ');
    await dialog['save']();
    expect(save).not.toHaveBeenCalled();
  });
});
