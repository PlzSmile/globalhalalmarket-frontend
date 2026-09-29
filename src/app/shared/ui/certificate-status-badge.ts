import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CertificateStatus } from '../../core/models/certificates';
import { StatusBadge } from './status-badge';

const VIEW: Record<CertificateStatus, { readonly tone: 'green' | 'amber' | 'red'; readonly label: string }> = {
  approved: { tone: 'green', label: 'Approved' },
  pending: { tone: 'amber', label: 'Pending review' },
  rejected: { tone: 'red', label: 'Rejected' },
};

/** Certificate review status, reusing the shared status chip (label always visible). */
@Component({
  selector: 'hs-certificate-status-badge',
  imports: [StatusBadge],
  template: `<hs-status-badge [status]="view().tone" [label]="view().label" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificateStatusBadge {
  readonly status = input.required<CertificateStatus>();
  protected readonly view = computed(() => VIEW[this.status()]);
}
