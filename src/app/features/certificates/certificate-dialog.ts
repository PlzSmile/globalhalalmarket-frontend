import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, debounceTime, distinctUntilChanged, firstValueFrom, lastValueFrom, of, switchMap, tap } from 'rxjs';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DateAdapter, MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { BodiesApi } from '../../core/api/bodies-api';
import { CertificatesApi } from '../../core/api/certificates-api';
import { IngredientsApi } from '../../core/api/ingredients-api';
import { SuppliersApi } from '../../core/api/suppliers-api';
import { NamedRef } from '../../core/models/catalogue';
import { BodyOption, CERTIFICATE_TYPES, CertificateDetail, CertificateFields, CertificateType } from '../../core/models/certificates';
import { toIsoDate, fromIsoDate } from '../../shared/format/uk-date';
import { UkDateAdapter } from '../../shared/format/uk-date-adapter';
import { collapseSpaces } from '../../shared/forms/normalise';
import { applyServerErrorsOr, clearServerErrors, serverError } from '../../shared/forms/server-errors';
import { FilePicker } from '../../shared/ui/file-picker';
import { SecurityBadge } from '../../shared/ui/security-badge';

export interface CertificateDialogData {
  readonly certificate: CertificateDetail | null;
  readonly supplier?: NamedRef | null;
}

type Picked<T> = T | string;

/** The control holds a picked object; typed text that was not picked is invalid. */
function picked(control: AbstractControl<Picked<NamedRef>>): ValidationErrors | null {
  return typeof control.value === 'object' && control.value !== null ? null : { picked: true };
}

@Component({
  selector: 'hs-certificate-dialog',
  // Typed dates are read day first (UK); the stock native adapter would read 12/03 as 3 December.
  providers: [provideNativeDateAdapter(), { provide: DateAdapter, useClass: UkDateAdapter }, { provide: MAT_DATE_LOCALE, useValue: 'en-GB' }],
  imports: [
    ReactiveFormsModule, MatAutocompleteModule, MatButtonModule, MatCheckboxModule, MatDatepickerModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatProgressBarModule, MatSelectModule, FilePicker, SecurityBadge,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.certificate ? 'Edit certificate' : 'Add certificate' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="fields">
        @if (formError(); as message) { <p class="notice notice--error" role="alert">{{ message }}</p> }

        @if (!data.certificate) {
          <div class="file">
            <span class="field-label">Certificate PDF</span>
            <hs-file-picker [disabled]="busy()" (fileChange)="onFile($event)" />
            @if (readNote(); as note) { <p class="notice notice--info read-note" role="status" data-test="read-note">{{ note }}</p> }
          </div>
        }

        <!-- 16 Nov 2026 (week 8): other certificate types. Only halal counts for recognition and red/amber/green. -->
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Certificate type</mat-label>
            <mat-select formControlName="type" (selectionChange)="onTypeChange($event.value)" data-test="type">
              @for (t of types; track t.value) { <mat-option [value]="t.value">{{ t.label }}</mat-option> }
            </mat-select>
            @if (!isHalal()) { <mat-hint>Tracked for expiry and reminders. Only halal certificates affect the red, amber and green status.</mat-hint> }
          </mat-form-field>
          @if (type() === 'other') {
            <mat-form-field appearance="outline">
              <mat-label>Name of the certificate</mat-label>
              <input matInput formControlName="type_name" maxlength="80" data-test="type-name" />
              @if (form.controls.type_name.hasError('required')) { <mat-error>Enter the name of the certificate.</mat-error> }
              @else if (serverError(form.controls.type_name); as m) { <mat-error>{{ m }}</mat-error> }
            </mat-form-field>
          }
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Supplier</mat-label>
          <input matInput formControlName="supplier_id" [matAutocomplete]="supplierAuto" autocomplete="off" required />
          <mat-autocomplete #supplierAuto="matAutocomplete" [displayWith]="displayName" (optionSelected)="onSupplierPicked($event.option.value)">
            @for (s of supplierOptions(); track s.id) { <mat-option [value]="s">{{ s.name }}</mat-option> }
          </mat-autocomplete>
          @if (form.controls.supplier_id.hasError('picked')) { <mat-error>Choose a supplier from your list.</mat-error> }
          @else if (serverError(form.controls.supplier_id); as m) { <mat-error>{{ m }}</mat-error> }
        </mat-form-field>

        @if (!isHalal()) {
          <mat-form-field appearance="outline">
            <mat-label>Issued by</mat-label>
            <input matInput formControlName="body_name_other" maxlength="160" data-test="issued-by" />
            <mat-hint>The certification body named on the certificate.</mat-hint>
            @if (form.controls.body_name_other.hasError('required')) { <mat-error>Enter who issued the certificate.</mat-error> }
            @else if (serverError(form.controls.body_name_other); as m) { <mat-error>{{ m }}</mat-error> }
          </mat-form-field>
        } @else if (!useOtherBody()) {
          <mat-form-field appearance="outline">
            <mat-label>Certification body</mat-label>
            <input matInput formControlName="certification_body_id" [matAutocomplete]="bodyAuto" autocomplete="off" />
            <mat-autocomplete #bodyAuto="matAutocomplete" [displayWith]="displayName">
              @for (b of bodyOptions(); track b.id) {
                <mat-option [value]="b">{{ b.name }}@if (b.country) { <span class="muted"> · {{ b.country.name }}</span> }</mat-option>
              }
            </mat-autocomplete>
            @if (form.controls.certification_body_id.hasError('picked')) { <mat-error>Choose the certification body from the list.</mat-error> }
            @else if (serverError(form.controls.certification_body_id); as m) { <mat-error>{{ m }}</mat-error> }
          </mat-form-field>
          <button mat-button type="button" class="btn link" (click)="useOtherBody.set(true)" data-test="other-body">Not in the list? Type the name</button>
        } @else {
          <mat-form-field appearance="outline">
            <mat-label>Certification body name</mat-label>
            <input matInput formControlName="body_name_other" maxlength="160" />
            <mat-hint>Certificates from bodies that no authority lists count as not recognised.</mat-hint>
            @if (form.controls.body_name_other.hasError('required')) { <mat-error>Type the certification body's name.</mat-error> }
            @else if (serverError(form.controls.body_name_other); as m) { <mat-error>{{ m }}</mat-error> }
          </mat-form-field>
          <button mat-button type="button" class="btn link" (click)="useOtherBody.set(false)">Search our list instead</button>
        }

        <fieldset class="ingredients">
          <legend class="field-label">Ingredients this certificate covers@if (!isHalal()) { <span class="muted"> (optional)</span> }</legend>
          @for (i of ingredientOptions(); track i.id) {
            <mat-checkbox [checked]="selected().has(i.id)" (change)="toggleIngredient(i, $event.checked)" [attr.data-test]="'ingredient-' + i.id">{{ i.name }}</mat-checkbox>
          } @empty {
            <p class="muted">{{ supplierChosen() ? 'This supplier has no ingredients linked yet. Search your ingredients below.' : 'Choose the supplier to see its ingredients, or search below.' }}</p>
          }
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Add another of your ingredients</mat-label>
            <input matInput formControlName="other_ingredient" [matAutocomplete]="ingAuto" autocomplete="off" />
            <mat-autocomplete #ingAuto="matAutocomplete" [displayWith]="blank" (optionSelected)="addIngredient($event.option.value)">
              @for (i of otherIngredientOptions(); track i.id) { <mat-option [value]="i">{{ i.name }}</mat-option> }
            </mat-autocomplete>
          </mat-form-field>
          @if (ingredientsError(); as m) { <p class="notice notice--error" role="alert">{{ m }}</p> }
        </fieldset>

        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Issue date (optional)</mat-label>
            <input matInput [matDatepicker]="issued" formControlName="issued_on" />
            <mat-datepicker-toggle matIconSuffix [for]="issued" />
            <mat-datepicker #issued />
            @if (form.controls.issued_on.hasError('matDatepickerParse')) { <mat-error>Enter the date as DD/MM/YYYY.</mat-error> }
            @else if (serverError(form.controls.issued_on); as m) { <mat-error>{{ m }}</mat-error> }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Expiry date</mat-label>
            <input matInput [matDatepicker]="expires" formControlName="expires_on" required />
            <mat-datepicker-toggle matIconSuffix [for]="expires" />
            <mat-datepicker #expires />
            @if (form.controls.expires_on.hasError('matDatepickerParse')) { <mat-error>Enter the date as DD/MM/YYYY.</mat-error> }
            @else if (form.controls.expires_on.hasError('required')) { <mat-error>Enter the expiry date.</mat-error> }
            @else if (form.controls.expires_on.hasError('order')) { <mat-error>The expiry date must be on or after the issue date.</mat-error> }
            @else if (serverError(form.controls.expires_on); as m) { <mat-error>{{ m }}</mat-error> }
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Certificate number (optional)</mat-label>
          <input matInput formControlName="certificate_number" maxlength="60" class="mono" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Scope (optional)</mat-label>
          <textarea matInput formControlName="scope" maxlength="500" rows="2"></textarea>
        </mat-form-field>

        @if (progress() !== null) { <mat-progress-bar mode="determinate" [value]="progress()" aria-label="Uploading" /> }
        <hs-security-badge />
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" class="btn" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" class="btn" [disabled]="busy()" data-test="save-certificate">Save</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .fields { display: grid; gap: var(--space-2); min-width: min(100%, var(--container-form)); overflow-x: hidden; }
    .fields mat-form-field { width: 100%; }
    .file, .ingredients { display: grid; gap: var(--space-2); margin: 0 0 var(--space-3); }
    .ingredients { border: 0; padding: 0; }
    .ingredients mat-checkbox { min-height: var(--touch-target); display: flex; align-items: center; }
    .field-label { font-weight: var(--weight-semibold); }
    .row { display: grid; gap: var(--space-2); grid-template-columns: minmax(0, 1fr); }
    @media (min-width: 600px) { .row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .btn { min-height: var(--touch-target); }
    .read-note { margin: var(--space-2) 0 0; }
    .link { justify-self: start; margin-top: calc(-1 * var(--space-2)); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificateDialog implements OnInit {
  protected readonly data = inject<CertificateDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<CertificateDialog, CertificateDetail>>(MatDialogRef);
  private readonly certificates = inject(CertificatesApi);
  private readonly bodies = inject(BodiesApi);
  private readonly suppliers = inject(SuppliersApi);
  private readonly ingredients = inject(IngredientsApi);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly serverError = serverError;
  protected readonly busy = signal(false);
  protected readonly progress = signal<number | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly ingredientsError = signal<string | null>(null);
  protected readonly file = signal<File | null>(null);
  protected readonly useOtherBody = signal(!!this.data.certificate?.body_name_other);
  protected readonly types = CERTIFICATE_TYPES;
  protected readonly type = signal<CertificateType>(this.data.certificate?.type ?? 'halal');
  protected readonly isHalal = computed(() => this.type() === 'halal');

  protected readonly form = this.fb.group({
    type: this.fb.control<CertificateType>(this.data.certificate?.type ?? 'halal'),
    type_name: [this.data.certificate?.type_name ?? '', [Validators.maxLength(80)]],
    supplier_id: this.fb.control<Picked<NamedRef>>(this.data.certificate?.supplier ?? this.data.supplier ?? '', picked),
    certification_body_id: this.fb.control<Picked<NamedRef | BodyOption>>(this.data.certificate?.body ?? ''),
    body_name_other: [this.data.certificate?.body_name_other ?? '', [Validators.maxLength(160)]],
    other_ingredient: this.fb.control<Picked<NamedRef>>(''),
    certificate_number: [this.data.certificate?.certificate_number ?? '', [Validators.maxLength(60)]],
    scope: [this.data.certificate?.scope ?? '', [Validators.maxLength(500)]],
    issued_on: this.fb.control<Date | null>(fromIsoDate(this.data.certificate?.issued_on)),
    expires_on: this.fb.control<Date | null>(fromIsoDate(this.data.certificate?.expires_on), Validators.required),
  });

  protected readonly supplierOptions = signal<readonly NamedRef[]>([]);
  protected readonly bodyOptions = signal<readonly BodyOption[]>([]);
  protected readonly otherIngredientOptions = signal<readonly NamedRef[]>([]);
  private readonly supplierIngredients = signal<readonly NamedRef[]>([]);
  protected readonly supplierChosen = signal(false);
  private readonly extraIngredients = signal<readonly NamedRef[]>(this.data.certificate?.ingredients ?? []);
  protected readonly selected = signal<ReadonlyMap<number, string>>(new Map((this.data.certificate?.ingredients ?? []).map((i) => [i.id, i.name])));

  protected readonly ingredientOptions = computed(() => {
    const byId = new Map<number, NamedRef>();
    for (const i of [...this.supplierIngredients(), ...this.extraIngredients()]) {
      byId.set(i.id, i);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly displayName = (value: Picked<NamedRef> | null): string => (typeof value === 'string' ? value : value?.name ?? '');
  protected readonly blank = (): string => '';

  constructor() {
    const search = <T>(control: AbstractControl, fetch: (text: string) => Observable<readonly T[]>, target: (r: readonly T[]) => void) =>
      control.valueChanges.pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((value) => (typeof value === 'string' ? fetch(collapseSpaces(value)).pipe(catchError(() => of([] as readonly T[]))) : of(null))),
        takeUntilDestroyed(),
      ).subscribe((results) => results && target(results));

    search<NamedRef>(this.form.controls.supplier_id, (t) => this.suppliers.search(t), (r) => this.supplierOptions.set(r));
    search<BodyOption>(this.form.controls.certification_body_id, (t) => this.bodies.search(t), (r) => this.bodyOptions.set(r));
    search<NamedRef>(this.form.controls.other_ingredient, (t) => this.ingredients.search(t), (r) => this.otherIngredientOptions.set(r));
  }

  protected readonly readNote = signal<string | null>(null);

  /**
   * 16 Nov 2026 (week 4): read the chosen PDF and fill the fields that are still empty (never overwrite what the person
   * typed). A scan or an unreadable file simply leaves the form as it is.
   */
  async onFile(file: File | null): Promise<void> {
    this.file.set(file);
    this.readNote.set(null);
    if (!file) {
      return;
    }
    this.readNote.set('Reading the PDF…');
    try {
      const r = await firstValueFrom(this.certificates.read(file));
      if (this.file() !== file) {
        return; // another file was chosen meanwhile
      }
      const c = this.form.controls;
      let filled = 0;
      const empty = (value: unknown): boolean => value === null || value === '';
      if (r.certification_body_id !== null && r.body_name && this.isHalal() && !this.useOtherBody() && empty(c.certification_body_id.value)) {
        c.certification_body_id.setValue({ id: r.certification_body_id, name: r.body_name });
        filled++;
      }
      if (r.certificate_number && empty(c.certificate_number.value)) {
        c.certificate_number.setValue(r.certificate_number);
        filled++;
      }
      if (r.issued_on && empty(c.issued_on.value)) {
        c.issued_on.setValue(fromIsoDate(r.issued_on));
        filled++;
      }
      if (r.expires_on && empty(c.expires_on.value)) {
        c.expires_on.setValue(fromIsoDate(r.expires_on));
        filled++;
      }
      this.readNote.set(filled > 0
        ? `We filled in ${filled} ${filled === 1 ? 'field' : 'fields'} from the PDF. Please check ${filled === 1 ? 'it' : 'them'} before saving.`
        : 'We could not read the details from this PDF (a scanned image has no text). Please fill in the form.');
    } catch {
      this.readNote.set(null); // reading is a help only: the form works as before
    }
  }

  ngOnInit(): void {
    const supplier = this.form.controls.supplier_id.value;
    if (typeof supplier === 'object' && supplier !== null) {
      void this.loadSupplierIngredients(supplier.id);
    }
  }

  protected onTypeChange(type: CertificateType): void {
    this.type.set(type);
    this.ingredientsError.set(null);
  }

  protected async onSupplierPicked(supplier: NamedRef): Promise<void> {
    await this.loadSupplierIngredients(supplier.id);
  }

  protected toggleIngredient(ingredient: NamedRef, checked: boolean): void {
    const next = new Map(this.selected());
    if (checked) {
      next.set(ingredient.id, ingredient.name);
    } else {
      next.delete(ingredient.id);
    }
    this.selected.set(next);
    this.ingredientsError.set(null);
  }

  protected addIngredient(ingredient: NamedRef): void {
    this.extraIngredients.set([...this.extraIngredients(), ingredient]);
    this.toggleIngredient(ingredient, true);
    this.form.controls.other_ingredient.setValue('');
  }

  protected async save(): Promise<void> {
    if (this.busy()) {
      return;
    }
    clearServerErrors(this.form);
    this.formError.set(null);
    this.ingredientsError.set(null);

    const fields = this.validFields();
    if (!fields) {
      return;
    }
    const file = this.file();
    if (!this.data.certificate && !file) {
      this.formError.set('Choose the certificate PDF.');
      return;
    }

    this.busy.set(true);
    try {
      const existing = this.data.certificate;
      if (existing) {
        this.dialogRef.close(await firstValueFrom(this.certificates.update(existing.id, fields)));
      } else {
        this.progress.set(0);
        const last = await lastValueFrom(this.certificates.create(fields, file as File).pipe(
          tap((event) => event.kind === 'progress' && this.progress.set(event.percent)),
        ));
        if (last.kind === 'done') {
          this.dialogRef.close(last.certificate);
        }
      }
    } catch (error) {
      this.formError.set(error instanceof HttpErrorResponse && error.status === 503
        ? (error.error?.message ?? 'The certificate could not be saved. Please try again.')
        : applyServerErrorsOr(this.form, error, 'The certificate could not be saved. Please try again.'));
    } finally {
      this.busy.set(false);
      this.progress.set(null);
    }
  }

  /** Client-side checks mirror the server; returns the API fields or null (errors shown). */
  private validFields(): CertificateFields | null {
    const c = this.form.controls;
    const supplier = c.supplier_id.value;
    const body = c.certification_body_id.value;
    const other = collapseSpaces(c.body_name_other.value);
    const issued = c.issued_on.value;
    const expires = c.expires_on.value;
    let valid = true;

    const halal = this.isHalal();
    const typeName = collapseSpaces(c.type_name.value);
    c.supplier_id.updateValueAndValidity();
    if (typeof supplier !== 'object') { valid = false; }
    if (this.type() === 'other' && !typeName) { c.type_name.setErrors({ required: true }); valid = false; }
    if (!halal) {
      // Week 8: another type keeps only the issuer's name (the catalogue lists halal certifiers).
      if (!other) { c.body_name_other.setErrors({ required: true }); valid = false; }
    } else if (this.useOtherBody()) {
      if (!other) { c.body_name_other.setErrors({ required: true }); valid = false; }
    } else if (typeof body !== 'object' || body === null) {
      c.certification_body_id.setErrors({ picked: true });
      valid = false;
    }
    if (halal && this.selected().size === 0) {
      this.ingredientsError.set('Choose at least one ingredient.');
      valid = false;
    }
    // A typed date the adapter cannot read leaves the value null with a parse error: never save it as "no date".
    const unreadable = c.issued_on.hasError('matDatepickerParse') || c.expires_on.hasError('matDatepickerParse');
    if (unreadable) {
      valid = false;
    } else if (!expires) {
      c.expires_on.setErrors({ required: true });
      valid = false;
    } else if (issued && issued > expires) {
      c.expires_on.setErrors({ order: true });
      valid = false;
    }
    if (!valid || typeof supplier !== 'object' || supplier === null || !expires) {
      this.form.markAllAsTouched();
      return null;
    }

    const text = (value: string): string | null => collapseSpaces(value) || null;
    return {
      supplier_id: supplier.id,
      type: this.type(),
      type_name: this.type() === 'other' ? typeName : null,
      certification_body_id: halal && !this.useOtherBody() ? (body as NamedRef).id : null,
      body_name_other: !halal || this.useOtherBody() ? other : null,
      certificate_number: text(c.certificate_number.value),
      scope: text(c.scope.value),
      issued_on: issued ? toIsoDate(issued) : null,
      expires_on: toIsoDate(expires),
      ingredient_ids: [...this.selected().keys()],
    };
  }

  private async loadSupplierIngredients(supplierId: number): Promise<void> {
    try {
      const supplier = await firstValueFrom(this.suppliers.get(supplierId));
      this.supplierIngredients.set(supplier.ingredients);
      this.supplierChosen.set(true);
    } catch {
      this.supplierIngredients.set([]);
    }
  }
}
