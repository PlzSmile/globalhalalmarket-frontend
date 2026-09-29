import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ImportsApi } from '../../core/api/imports-api';
import { AuthService } from '../../core/auth/auth.service';
import { ImportCounts, ImportPreview, ImportResult } from '../../core/models/imports';
import { FilePicker } from '../../shared/ui/file-picker';

const FILE_MESSAGE = 'Choose a CSV file (max 2 MB).';

/** Catalogue CSV import: choose file → preview (nothing saved) → import (all-or-nothing). Owners and admins. */
@Component({
  selector: 'hs-catalogue-import',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatExpansionModule, MatProgressBarModule, FilePicker],
  template: `
    <a routerLink="/products" class="back">← Products</a>
    <h1 class="page-top__title">Import products &amp; suppliers</h1>

    @if (!auth.canManageTeam()) {
      <mat-card appearance="outlined" class="hs-card"><mat-card-content class="stack">
        <p class="notice notice--info" data-test="not-allowed">Only owners and admins can import.</p>
        <a mat-stroked-button routerLink="/products" class="btn">Back to products</a>
      </mat-card-content></mat-card>
    } @else {
      <mat-card appearance="outlined" class="hs-card"><mat-card-content class="stack">
        @if (result(); as r) {
          <h2 class="card-title">Import finished</h2>
          <p data-test="result">{{ summary(r.counts) }}</p>
          @if (r.warnings?.length) {
            <div class="issues" data-test="result-warnings">
              <p class="notice notice--info">Please check these rows (nothing was overwritten):</p>
              <ul class="rows">
                @for (issue of r.warnings; track $index) { <li>Row {{ issue.row }}: {{ issue.message }}</li> }
              </ul>
            </div>
          }
          <div class="actions">
            <a mat-flat-button routerLink="/products" class="btn">View products</a>
            <a mat-stroked-button routerLink="/suppliers" class="btn">View suppliers</a>
            <button mat-button type="button" class="btn" (click)="reset()">Import another file</button>
          </div>
        } @else {
          <p>
            One row per ingredient of a product, with the columns
            <span class="mono">product_name</span>, <span class="mono">sku</span>, <span class="mono">ingredient</span>,
            <span class="mono">supplier</span>, <span class="mono">supplier_email</span>, <span class="mono">supplier_country</span>.
            Only the product name and ingredient are required. Existing products, ingredients and suppliers are reused;
            nothing you already have is overwritten.
          </p>
          <a [href]="api.templateUrl" class="template" download data-test="template">Download the template (CSV)</a>
          <hs-file-picker label="Choose CSV file" againLabel="Choose another file" accept=".csv,text/csv"
                          [extensions]="extensions" [mimeTypes]="mimeTypes" [typeMessage]="fileMessage" [sizeMessage]="fileMessage"
                          [maxBytes]="maxBytes" [disabled]="busy() !== null" (fileChange)="onFile($event)" />
          @if (busy() === 'previewing') { <mat-progress-bar mode="indeterminate" aria-label="Checking the file" /> }
          @if (formError(); as message) { <p class="notice notice--error" role="alert" data-test="form-error">{{ message }}</p> }

          @if (preview(); as p) {
            <section class="preview" aria-live="polite">
              <h2 class="card-title">Preview</h2>
              <p data-test="summary">{{ summary(p.counts) }}</p>
              @if (p.errors.length) {
                <div class="issues" data-test="errors">
                  <p class="notice notice--error" role="alert">Fix these rows in your file and choose it again.</p>
                  <ul class="rows">
                    @for (issue of p.errors; track $index) {
                      <li>Row {{ issue.row }}@if (issue.column) { · <span class="mono">{{ issue.column }}</span>}: {{ issue.message }}</li>
                    }
                  </ul>
                  @if (p.errors_total > p.errors.length) { <p class="muted">and {{ p.errors_total - p.errors.length }} more</p> }
                </div>
              }
              @if (p.warnings.length) {
                <mat-expansion-panel data-test="warnings">
                  <mat-expansion-panel-header>
                    <mat-panel-title>{{ p.warnings.length }} {{ p.warnings.length === 1 ? 'warning' : 'warnings' }}</mat-panel-title>
                  </mat-expansion-panel-header>
                  <ul class="rows">
                    @for (issue of p.warnings; track $index) { <li>Row {{ issue.row }}: {{ issue.message }}</li> }
                  </ul>
                </mat-expansion-panel>
              }
              <div class="actions">
                <button mat-flat-button type="button" class="btn" (click)="runImport()" [disabled]="!p.can_import || busy() !== null" data-test="run-import">Import</button>
                <button mat-button type="button" class="btn" (click)="reset()" [disabled]="busy() !== null">Choose another file</button>
              </div>
              @if (busy() === 'importing') { <mat-progress-bar mode="indeterminate" aria-label="Importing" /> }
            </section>
          }
        }
      </mat-card-content></mat-card>
    }
  `,
  styles: `
    :host { display: grid; gap: var(--space-4); }
    .back, .template { display: inline-flex; align-items: center; min-height: 44px; }
    .page-top__title { font-size: var(--text-3xl); }
    .stack, .preview, .issues { display: grid; gap: var(--space-3); }
    .card-title { font-size: var(--text-xl); }
    .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .btn { min-height: 44px; }
    .rows { margin: 0; padding-inline-start: var(--space-5); display: grid; gap: var(--space-1); overflow-wrap: anywhere; }
    .notice { margin: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogueImport {
  protected readonly api = inject(ImportsApi);
  protected readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly picker = viewChild(FilePicker);

  protected readonly extensions = ['.csv', '.txt'];
  /** Extension only: browsers report CSV files under many types; the server checks the content. */
  protected readonly mimeTypes: readonly string[] = [];
  protected readonly fileMessage = FILE_MESSAGE;
  protected readonly maxBytes = 2 * 1024 * 1024;

  protected readonly file = signal<File | null>(null);
  protected readonly preview = signal<ImportPreview | null>(null);
  protected readonly result = signal<ImportResult | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly busy = signal<'previewing' | 'importing' | null>(null);
  /** Only the newest preview may update the page (a slow older reply must not overwrite a newer one). */
  private latestRequest = 0;

  protected summary(c: ImportCounts): string {
    const filled = c.suppliers.fill ? ` (${c.suppliers.fill} updated)` : '';
    return `Products: ${c.products.create} new, ${c.products.reuse} existing · `
      + `Ingredients: ${c.ingredients.create} new, ${c.ingredients.reuse} existing · `
      + `Suppliers: ${c.suppliers.create} new, ${c.suppliers.reuse} existing${filled} · `
      + `Links: ${c.links.add} new, ${c.links.existing} already there`;
  }

  protected async onFile(file: File | null): Promise<void> {
    const request = ++this.latestRequest;
    this.file.set(file);
    this.preview.set(null);
    this.result.set(null);
    this.formError.set(null);
    if (!file) {
      this.busy.set(null);
      return;
    }
    this.busy.set('previewing');
    try {
      const preview = await firstValueFrom(this.api.preview(file));
      if (request === this.latestRequest) {
        this.preview.set(preview);
      }
    } catch (error) {
      if (request === this.latestRequest) {
        this.formError.set(this.message(error, 'The file could not be checked. Please try again.'));
      }
    } finally {
      if (request === this.latestRequest) {
        this.busy.set(null);
      }
    }
  }

  protected async runImport(): Promise<void> {
    const file = this.file();
    const preview = this.preview();
    if (!file || !preview?.can_import || this.busy() !== null) {
      return;
    }
    this.busy.set('importing');
    this.formError.set(null);
    try {
      const result = await firstValueFrom(this.api.import(file, preview.fingerprint));
      this.result.set(result);
      this.preview.set(null);
      this.snackBar.open('Import finished.', 'Close', { duration: 4000 });
    } catch (error) {
      const data = error instanceof HttpErrorResponse && error.status === 422 ? (error.error?.data as ImportPreview | undefined) : undefined;
      if (data) {
        this.preview.set(data); // rows changed since the preview: show the new problems
      } else {
        this.formError.set(this.message(error, 'The import failed. Nothing was imported. Please try again.'));
      }
    } finally {
      this.busy.set(null);
    }
  }

  protected reset(): void {
    this.latestRequest++;
    this.file.set(null);
    this.preview.set(null);
    this.result.set(null);
    this.formError.set(null);
    this.busy.set(null);
    this.picker()?.clear();
  }

  private message(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && error.status === 422) {
      const errors = (error.error?.errors ?? {}) as Record<string, string[]>;
      if (errors['fingerprint']) {
        return 'The file changed since the preview. Please choose it again.';
      }
      const first = Object.values(errors)[0]?.[0];
      if (first) {
        return first;
      }
      if (typeof error.error?.message === 'string') {
        return error.error.message; // e.g. a colleague changed the catalogue during the import
      }
    }
    return fallback;
  }
}
