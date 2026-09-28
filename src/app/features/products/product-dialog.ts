import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ProductsApi } from '../../core/api/products-api';
import { ProductDetail } from '../../core/models/catalogue';
import { collapseSpaces } from '../../shared/forms/normalise';
import { applyServerErrorsOr, clearServerErrors, serverError } from '../../shared/forms/server-errors';

export interface ProductDialogData {
  readonly product: { readonly id: number; readonly name: string; readonly sku: string | null } | null;
}

const SKU_PATTERN = /^[A-Za-z0-9._\-/ ]+$/;

@Component({
  selector: 'hs-product-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
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
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" class="btn" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" class="btn" [disabled]="busy()" data-test="save-product">Save</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `.fields { display: grid; gap: var(--space-2); min-width: min(100%, var(--container-form)); } .fields mat-form-field { width: 100%; } .btn { min-height: 44px; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDialog {
  protected readonly data = inject<ProductDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ProductDialog, ProductDetail>>(MatDialogRef);
  private readonly api = inject(ProductsApi);
  protected readonly serverError = serverError;
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);
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
    this.busy.set(true);
    try {
      const input = { name, sku: sku === '' ? null : sku };
      const product = this.data.product;
      this.dialogRef.close(await firstValueFrom(product ? this.api.update(product.id, input) : this.api.create(input)));
    } catch (error) {
      this.formError.set(applyServerErrorsOr(this.form, error, 'The product could not be saved. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }
}
