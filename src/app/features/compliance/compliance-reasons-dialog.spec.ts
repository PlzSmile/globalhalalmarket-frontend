import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ComplianceReasonsDialog } from './compliance-reasons-dialog';
import { ComplianceApi } from '../../core/api/compliance-api';
import { CertificatesApi } from '../../core/api/certificates-api';
import { AuthService } from '../../core/auth/auth.service';
import { settle } from '../../../testing/settle';

function setup(product: ReturnType<typeof vi.fn>) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: MAT_DIALOG_DATA, useValue: { productId: 3, productName: 'Beef sausage', market: 'JAKIM' } },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: ComplianceApi, useValue: { product } },
      { provide: CertificatesApi, useValue: {} },
      { provide: AuthService, useValue: { canManageTeam: () => false } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(ComplianceReasonsDialog);
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('ComplianceReasonsDialog', () => {
  it('loads the product breakdown for the chosen market', async () => {
    const product = vi.fn(() => of([{ market: 'JAKIM', authority: 'JAKIM', status: 'red', next_expiry_on: null, reasons: ['Gelatin — No supplier linked — link a supplier'], ingredients: [] }]));
    const { fixture, el } = setup(product);
    await settle(fixture);
    expect(product).toHaveBeenCalledWith(3);
    expect(el.textContent).toContain('Why? · Beef sausage');
    expect(el.textContent).toContain('No supplier linked — link a supplier');
  });

  it('offers a retry when loading fails', async () => {
    const { fixture, el } = setup(vi.fn(() => throwError(() => new Error('offline'))));
    await settle(fixture);
    expect(el.textContent).toContain("We couldn't load the reasons.");
  });
});
