import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { TwoFactorDialog } from './two-factor-dialog';
import { MeApi } from '../../core/api/me-api';
import { settle } from '../../../testing/settle';

describe('TwoFactorDialog', () => {
  it('the password step submits through the real form event (no page reload)', async () => {
    const disableTwoFactor = vi.fn(() => of(undefined));
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [TwoFactorDialog],
      providers: [
        { provide: MeApi, useValue: { disableTwoFactor } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: 'disable' },
      ],
    });
    const fixture = TestBed.createComponent(TwoFactorDialog);
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    fixture.componentInstance['password'].setValue('a-long-password');

    // 4 Nov 2026: the form used (ngSubmit) without a form directive, so the browser reloaded the page instead.
    const submitted = new Event('submit', { cancelable: true });
    el.querySelector('form#tf-password')!.dispatchEvent(submitted);
    await settle(fixture);

    expect(submitted.defaultPrevented).toBe(true);
    expect(disableTwoFactor).toHaveBeenCalledWith('a-long-password');
  });
});
