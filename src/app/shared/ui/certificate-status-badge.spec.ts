import { TestBed } from '@angular/core/testing';
import { CertificateStatusBadge } from './certificate-status-badge';

describe('CertificateStatusBadge', () => {
  it.each([
    ['approved', 'Approved', 'hs-status--success'],
    ['pending', 'Pending review', 'hs-status--warning'],
    ['rejected', 'Rejected', 'hs-status--danger'],
  ] as const)('shows %s with a readable label and tone', (status, label, tone) => {
    const fixture = TestBed.createComponent(CertificateStatusBadge);
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(label);
    expect(el.querySelector('mat-chip')?.classList).toContain(tone);
  });
});
