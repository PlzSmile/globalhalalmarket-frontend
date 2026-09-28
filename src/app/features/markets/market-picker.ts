import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormControl, FormRecord, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MarketsApi } from '../../core/api/markets-api';
import { AuthorityCode, MarketOption } from '../../core/models/markets';
import { applyServerErrorsOr } from '../../shared/forms/server-errors';

/** Tick the export markets and save. Used in the dashboard dialog and in Settings → Markets. */
@Component({
  selector: 'hs-market-picker',
  imports: [ReactiveFormsModule, MatButtonModule, MatCheckboxModule, MatProgressBarModule],
  template: `
    <form class="picker" [formGroup]="form" (ngSubmit)="save()" novalidate>
      <fieldset class="picker__list">
        <legend class="visually-hidden">Export markets</legend>
        @for (option of markets(); track option.code) {
          <div class="picker__row">
            <mat-checkbox [formControlName]="option.code" [attr.data-test]="'market-' + option.code">
              <span class="picker__name">{{ option.market }} · {{ option.authority }}</span>
            </mat-checkbox>
            @if (option.data_note) { <p class="picker__note">{{ option.data_note }}</p> }
          </div>
        }
      </fieldset>
      @if (error(); as message) { <p class="notice notice--error" role="alert">{{ message }}</p> }
      @if (!readonly()) {
        <div class="picker__actions">
          <ng-content select="[pickerCancel]" />
          <button mat-flat-button type="submit" [disabled]="busy()" data-test="save-markets">Save markets</button>
        </div>
      }
      @if (busy()) { <mat-progress-bar mode="indeterminate" aria-label="Saving markets" /> }
    </form>
  `,
  styles: `
    .picker { display: grid; gap: var(--space-4); }
    .picker__list { border: 0; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
    .picker__row { display: grid; gap: var(--space-1); padding-block: var(--space-2); border-bottom: 1px solid var(--color-border); }
    .picker__row mat-checkbox { min-height: 44px; display: flex; align-items: center; }
    .picker__name { font-weight: var(--weight-semibold); }
    .picker__note { color: var(--color-text-muted); font-size: var(--text-sm); padding-inline-start: var(--space-10); }
    .picker__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-2); }
    .picker__actions button { min-height: 44px; }
    @media (max-width: 767px) { .picker__actions > * { flex: 1 1 100%; } .picker__note { padding-inline-start: 0; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketPicker implements OnInit {
  readonly markets = input.required<readonly MarketOption[]>();
  readonly readonly = input(false);
  readonly saved = output<readonly MarketOption[]>();

  private readonly api = inject(MarketsApi);
  protected readonly form = new FormRecord<FormControl<boolean>>({});
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    for (const option of this.markets()) {
      this.form.addControl(option.code, new FormControl(option.selected, { nonNullable: true }));
    }
    if (this.readonly()) {
      this.form.disable();
    }
  }

  async save(): Promise<void> {
    if (this.readonly() || this.busy()) {
      return;
    }
    this.error.set(null);
    const codes: AuthorityCode[] = this.markets().map((m) => m.code).filter((code) => this.form.controls[code]?.value === true);
    if (codes.length === 0) {
      this.error.set('Choose at least one market.');
      return;
    }
    this.busy.set(true);
    try {
      this.saved.emit(await firstValueFrom(this.api.update(codes)));
    } catch (error) {
      this.error.set(error instanceof HttpErrorResponse && error.status === 403
        ? 'Only owners and admins can change markets.'
        : applyServerErrorsOr(this.form, error, 'Your markets could not be saved. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }
}
