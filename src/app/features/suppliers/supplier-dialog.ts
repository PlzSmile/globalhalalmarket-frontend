import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { catchError, firstValueFrom, of } from 'rxjs';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CountriesApi } from '../../core/api/countries-api';
import { SuppliersApi } from '../../core/api/suppliers-api';
import { Country, SupplierDetail } from '../../core/models/catalogue';
import { collapseSpaces } from '../../shared/forms/normalise';
import { applyServerErrorsOr, clearServerErrors, serverError } from '../../shared/forms/server-errors';

export interface SupplierDialogData { readonly supplier: SupplierDetail | null; }

/** The country field holds a Country (picked) or text (typing); only a picked country or empty is valid. */
function countryPicked(control: AbstractControl<Country | string>): ValidationErrors | null {
  const value = control.value;
  return value === '' || typeof value === 'object' ? null : { country: true };
}

@Component({
  selector: 'hs-supplier-dialog',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.supplier ? 'Edit supplier' : 'Add supplier' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="fields">
        @if (formError(); as message) { <p class="notice notice--error" role="alert">{{ message }}</p> }
        <mat-form-field appearance="outline">
          <mat-label>Supplier company name</mat-label>
          <input matInput formControlName="name" maxlength="160" required cdkFocusInitial />
          @if (form.controls.name.hasError('required')) { <mat-error>Enter the supplier's name.</mat-error> }
          @else if (serverError(form.controls.name); as message) { <mat-error>{{ message }}</mat-error> }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Contact email (optional)</mat-label>
          <input matInput type="email" formControlName="contact_email" maxlength="254" autocomplete="off" />
          <mat-hint>Used later to send upload links for certificates.</mat-hint>
          @if (form.controls.contact_email.hasError('email')) { <mat-error>Enter a valid email address.</mat-error> }
          @else if (serverError(form.controls.contact_email); as message) { <mat-error>{{ message }}</mat-error> }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Country (optional)</mat-label>
          <input matInput formControlName="country" [matAutocomplete]="countries" autocomplete="off" />
          <mat-autocomplete #countries="matAutocomplete" [displayWith]="displayCountry">
            @for (country of filteredCountries(); track country.code) {
              <mat-option [value]="country">{{ country.name }}</mat-option>
            }
          </mat-autocomplete>
          @if (form.controls.country.hasError('country')) { <mat-error>Choose a country from the list.</mat-error> }
          @else if (serverError(form.controls.country); as message) { <mat-error>{{ message }}</mat-error> }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" class="btn" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" class="btn" [disabled]="busy()" data-test="save-supplier">Save</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `.fields { display: grid; gap: var(--space-2); min-width: min(100%, var(--container-form)); } .fields mat-form-field { width: 100%; } .btn { min-height: 44px; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierDialog {
  protected readonly data = inject<SupplierDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<SupplierDialog, SupplierDetail>>(MatDialogRef);
  private readonly api = inject(SuppliersApi);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly serverError = serverError;
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    name: [this.data.supplier?.name ?? '', [Validators.required, Validators.maxLength(160)]],
    contact_email: [this.data.supplier?.contact_email ?? '', [Validators.email, Validators.maxLength(254)]],
    country: this.fb.control<Country | string>(this.data.supplier?.country ?? '', countryPicked),
  });

  // A failed request must not break the dialog (a toSignal of an errored observable throws when read).
  private readonly countries = toSignal(inject(CountriesApi).list().pipe(catchError(() => of([] as readonly Country[]))), { initialValue: [] as readonly Country[] });
  private readonly countryValue = toSignal(this.form.controls.country.valueChanges, { initialValue: this.form.controls.country.value });
  protected readonly filteredCountries = computed(() => {
    const value = this.countryValue();
    const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return this.countries().filter((c) => !text || c.name.toLowerCase().includes(text)).slice(0, 50);
  });
  protected readonly displayCountry = (value: Country | string | null): string => (typeof value === 'string' ? value : value?.name ?? '');

  protected async save(): Promise<void> {
    if (this.busy()) {
      return;
    }
    clearServerErrors(this.form);
    this.formError.set(null);
    const name = collapseSpaces(this.form.controls.name.value);
    const email = collapseSpaces(this.form.controls.contact_email.value);
    const country = this.form.controls.country.value;
    this.form.patchValue({ name, contact_email: email, country: typeof country === 'string' ? collapseSpaces(country) : country });
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    try {
      const picked = this.form.controls.country.value;
      const input = { name, contact_email: email === '' ? null : email, country_code: typeof picked === 'object' ? picked.code : null };
      const supplier = this.data.supplier;
      this.dialogRef.close(await firstValueFrom(supplier ? this.api.update(supplier.id, input) : this.api.create(input)));
    } catch (error) {
      this.formError.set(applyServerErrorsOr(this.form, error, 'The supplier could not be saved. Please try again.'));
    } finally {
      this.busy.set(false);
    }
  }
}
