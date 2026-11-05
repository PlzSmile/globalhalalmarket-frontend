import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ProductsApi } from '../../core/api/products-api';
import { MarketsApi } from '../../core/api/markets-api';
import { AuthorityCode, marketLabel } from '../../core/models/markets';
import { ProductDetail } from '../../core/models/catalogue';
import { collapseSpaces } from '../../shared/forms/normalise';
import { applyServerErrorsOr, clearServerErrors, serverError } from '../../shared/forms/server-errors';

export interface ProductDialogData {
  readonly product: { readonly id: number; readonly name: string; readonly sku: string | null; readonly markets?: readonly AuthorityCode[] } | null;
}

const SKU_PATTERN = /^[A-Za-z0-9._\-/ ]+$/;

@Component({
  selector: 'hs-product-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatCheckboxModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.product ? 'Edit product' : 'Add product' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="fields">
        @if (formError(); as message) { <p class="notice notice--error" role="alert">{{ message }}</p> }
        <mat-form-field appearance="outline">
          <mat-label>Product name</mat-label>
          <input matInput formControlName="name" maxlength="120" required cdkFocusInitial />
          @if (form.controls.name.hasError('required')) { <mat-error>Enter the product name.</mat-error> }
          @else if (serverError(form.controls.name); as message) { <mat-error>{{ message }}</mat-error> }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>SKU (optional)</mat-label>
          <input matInput formControlName="sku" maxlength="60" class="mono" />
          <mat-hint>Your own product code, e.g. CS-500.</mat-hint>
          @if (form.controls.sku.hasError('pattern')) { <mat-error>Use letters, numbers, spaces and . _ - / only.</mat-error> }
          @else if (serverError(form.controls.sku); as message) { <mat-error>{{ message }}</mat-error> }
        </mat-form-field>
        <!-- 5 Nov 2026 (Bilal): a product can be exported to only some of your markets. Hidden with one market (nothing to choose). -->
        @if (markets().length > 1) {
          <fieldset class="markets" data-test="product-markets">
            <legend class="markets__legend">Exported to</legend>
            @for (code of markets(); track code) {
              <mat-checkbox [checked]="chosen().has(code)" (change)="toggle(code, $event.checked)" [attr.data-test]="'market-' + code">{{ label(code) }}</mat-checkbox>
            }
            <p class="markets__hint" [class.markets__hint--error]="marketsError()">{{ marketsError() ? 'Choose at least one market.' : 'Untick a market this product is not sold in. It is then not checked for that market.' }}</p>
          </fieldset>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" class="btn" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" class="btn" [disabled]="busy()" data-test="save-product">Save</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `.fields { display: grid; gap: var(--space-2); min-width: min(100%, var(--container-form)); } .fields mat-form-field { width: 100%; } .btn { min-height: var(--touch-target); }
    .markets { border: 0; margin: 0; padding: 0; display: grid; gap: var(--space-1); }
    .markets__legend { font-weight: var(--weight-semibold); margin-bottom: var(--space-1); }
    .markets mat-checkbox { min-height: var(--touch-target); display: flex; align-items: center; }
    .markets__hint { margin: 0; font-size: var(--text-sm); color: var(--color-text-muted); }
    .markets__hint--error { color: var(--color-danger-fg); }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDialog {
  protected readonly data = inject<ProductDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ProductDialog, ProductDetail>>(MatDialogRef);
  private readonly api = inject(ProductsApi);
  protected readonly serverError = serverError;
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);
  private readonly marketsApi = inject(MarketsApi);
  protected readonly label = marketLabel;
  /** The company's markets (codes); a new product starts with all of them ticked. */
  protected readonly markets = signal<readonly AuthorityCode[]>([]);
  protected readonly chosen = signal<ReadonlySet<AuthorityCode>>(new Set());
  protected readonly marketsError = signal(false);

  constructor() {
    void this.loadMarkets();
  }

  private async loadMarkets(): Promise<void> {
    try {
      const codes = (await firstValueFrom(this.marketsApi.list())).filter((m) => m.selected).map((m) => m.code);
      this.markets.set(codes);
      const current = this.data.product?.markets;
      this.chosen.set(new Set(current && current.length ? current.filter((c) => codes.includes(c)) : codes));
    } catch {
      this.markets.set([]); // the product still saves; it then follows all markets
    }
  }

  protected toggle(code: AuthorityCode, checked: boolean): void {
    const next = new Set(this.chosen());
    if (checked) {
      next.add(code);
    } else {
      next.delete(code);
    }
    this.chosen.set(next);
    this.marketsError.set(false);
  }

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data.product?.name ?? '', [Validators.required, Validators.maxLength(120)]],
    sku: [this.data.product?.sku ?? '', [Validators.maxLength(60), Validators.pattern(SKU_PATTERN)]],
  });

  protected async save(): Promise<void> {
    if (this.busy()) {
      return;
    }
    clearServerErrors(this.form);
    this.formError.set(null);
    const name = collapseSpaces(this.form.controls.name.value);
    const sku = collapseSpaces(this.form.controls.sku.value);
    this.form.setValue({ name, sku });
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const withMarkets = this.markets().length > 1;
    if (withMarkets && this.chosen().size === 0) {
      this.marketsError.set(true);
      return;
    }
    this.busy.set(true);
    try {
      const input = { name, sku: sku === '' ? null : sku, ...(withMarkets ? { markets: this.markets().filter((c) => this.chosen().has(c)) } : {}) };
      const product = this.data.product;
      this.dialogRef.close(await firstValueFrom(product ? this.api.update(product.id, input) : this.api.create(input)));
    } catch (error) {
      this.formError.set(applyServerErrorsOr(this.form, error, 'The product could not be saved. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }
}
