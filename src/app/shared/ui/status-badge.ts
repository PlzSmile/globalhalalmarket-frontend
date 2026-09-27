import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ComplianceStatus } from '../../core/models/compliance';

const PRESENTATION: Record<ComplianceStatus, { readonly tone: string; readonly label: string }> = {
  green: { tone: 'success', label: 'Compliant' },
  amber: { tone: 'warning', label: 'Expiring soon' },
  red: { tone: 'danger', label: 'Action needed' },
};

/**
 * Traffic-light status as a Material chip. Colour is never the only signal: the label is always shown.
 */
@Component({
  selector: 'hs-status-badge',
  imports: [MatChipsModule, MatTooltipModule],
  template: `
    <mat-chip-set [attr.aria-label]="'Status: ' + (label() ?? view().label)">
      <mat-chip [class]="'hs-status hs-status--' + view().tone" [disableRipple]="true" [matTooltip]="reason() ?? ''" [matTooltipDisabled]="!reason()">
        <span class="hs-status__dot" aria-hidden="true"></span>{{ label() ?? view().label }}
      </mat-chip>
    </mat-chip-set>
  `,
  styles: `
    .hs-status {
      --mat-chip-container-height: 26px;
      --mat-chip-container-shape-radius: var(--radius-pill);
      --mat-chip-label-text-size: var(--text-xs);
      --mat-chip-label-text-weight: var(--weight-semibold);
      --mat-chip-outline-width: 1px;
      pointer-events: auto;
    }
    .hs-status__dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: currentColor; margin-right: 6px; }
    .hs-status--success { --mat-chip-elevated-container-color: var(--color-success-bg); --mat-chip-label-text-color: var(--color-success-fg); --mat-chip-outline-color: var(--color-success-border); }
    .hs-status--warning { --mat-chip-elevated-container-color: var(--color-warning-bg); --mat-chip-label-text-color: var(--color-warning-fg); --mat-chip-outline-color: var(--color-warning-border); }
    .hs-status--danger { --mat-chip-elevated-container-color: var(--color-danger-bg); --mat-chip-label-text-color: var(--color-danger-fg); --mat-chip-outline-color: var(--color-danger-border); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadge {
  readonly status = input.required<ComplianceStatus>();
  readonly label = input<string | null>(null);
  readonly reason = input<string | null>(null);

  protected readonly view = computed(() => PRESENTATION[this.status()]);
}
