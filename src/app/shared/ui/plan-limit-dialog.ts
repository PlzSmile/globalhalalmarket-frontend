import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface PlanLimitDialogData { readonly message: string; readonly isOwner: boolean; }

/** Phase 7a: shown when the server answers 422 plan_limit. Owners can go to the plans; others ask their owner. */
@Component({
  selector: 'hs-plan-limit-dialog',
  imports: [RouterLink, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Plan limit reached</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
      @if (!data.isOwner) { <p>Ask your account owner to choose a bigger plan.</p> }
      <p class="hint">Nothing was removed: everything you already have keeps working.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Close</button>
      @if (data.isOwner) {
        <a mat-flat-button routerLink="/settings" [queryParams]="{ tab: 'billing' }" mat-dialog-close>See plans</a>
      }
    </mat-dialog-actions>
  `,
  styles: `.hint { color: var(--color-text-muted); font-size: var(--text-sm); } button, a { min-height: var(--touch-target); }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanLimitDialog {
  protected readonly data = inject<PlanLimitDialogData>(MAT_DIALOG_DATA);
}
