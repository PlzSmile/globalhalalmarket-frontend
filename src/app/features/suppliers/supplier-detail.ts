import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IngredientsApi } from '../../core/api/ingredients-api';
import { SuppliersApi } from '../../core/api/suppliers-api';
import { LinkTarget, NamedRef, SupplierDetail } from '../../core/models/catalogue';
import { CertificateDetail, bodyName } from '../../core/models/certificates';
import { errorMessage, isNotFound } from '../../shared/forms/error-message';
import { ukDate } from '../../shared/format/uk-date';
import { CertificateStatusBadge } from '../../shared/ui/certificate-status-badge';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/ui/confirm-dialog';
import { LinkPicker } from '../../shared/ui/link-picker';
import { UploadRequestsApi } from '../../core/api/upload-requests-api';
import { CLOSED_REASON_TEXT, UploadRequestItem } from '../../core/models/upload-requests';
import { CertificateDialog, CertificateDialogData } from '../certificates/certificate-dialog';
import { UploadRequestDialog, UploadRequestDialogData } from './upload-request-dialog';
import { SupplierDialog, SupplierDialogData } from './supplier-dialog';

type State = { kind: 'loading' } | { kind: 'notFound' } | { kind: 'error' } | { kind: 'ready'; supplier: SupplierDetail };

@Component({
  selector: 'hs-supplier-detail',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule, LinkPicker, CertificateStatusBadge],
  template: `
    <a routerLink="/suppliers" class="back">← All suppliers</a>
    @let s = state();
    @if (s.kind === 'loading') {
      <mat-progress-bar mode="indeterminate" aria-label="Loading supplier" />
    } @else if (s.kind === 'notFound') {
      <mat-card appearance="outlined" class="hs-card"><mat-card-content class="load-error">
        <h1 class="card-title">Supplier not found</h1>
        <p class="muted">It may have been deleted.</p>
        <a mat-stroked-button routerLink="/suppliers" class="btn">Back to suppliers</a>
      </mat-card-content></mat-card>
    } @else if (s.kind === 'error') {
      <mat-card appearance="outlined" class="hs-card"><mat-card-content class="load-error">
        <p role="alert">We couldn't load this supplier.</p>
        <button mat-stroked-button type="button" class="btn" (click)="load()" data-test="retry">Try again</button>
      </mat-card-content></mat-card>
    } @else {
      @let supplier = s.supplier;
      <header class="page-top">
        <div>
          <h1 class="page-top__title">{{ supplier.name }}</h1>
          <p class="muted">{{ supplier.country?.name ?? 'Country not set' }}</p>
          @if (supplier.contact_email) {
            <p><a [href]="mailto(supplier.contact_email)" class="mail" data-test="mailto">{{ supplier.contact_email }}</a></p>
          } @else {
            <p class="muted">No contact email yet.</p>
          }
        </div>
        <div class="actions">
          <button mat-stroked-button type="button" class="btn" (click)="editSupplier(supplier)" [disabled]="busy()">Edit</button>
          <button mat-stroked-button type="button" class="btn" (click)="deleteSupplier()" [disabled]="busy()">Delete</button>
        </div>
      </header>

      <mat-card appearance="outlined" class="hs-card">
        <mat-card-header><mat-card-title><h2 class="card-title">Ingredients it supplies</h2></mat-card-title></mat-card-header>
        <mat-card-content>
          <hs-link-picker label="Add ingredient (search or type a new one)" testId="add-ingredient" [search]="searchIngredients"
                          [excludeIds]="ingredientIds(supplier)" [busy]="busy()" (picked)="linkIngredient($event)" />
          @if (supplier.ingredients.length === 0) {
            <p class="muted">No ingredients linked yet.</p>
          } @else {
            <ul class="rows">
              @for (ingredient of supplier.ingredients; track ingredient.id) {
                <li class="row">
                  <span>{{ ingredient.name }}</span>
                  <button mat-button type="button" class="btn" (click)="unlinkIngredient(ingredient)" [disabled]="busy()"
                          [attr.aria-label]="'Remove ' + ingredient.name + ' from ' + supplier.name">Remove</button>
                </li>
              }
            </ul>
          }
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined" class="hs-card" data-test="supplier-certificates">
        <mat-card-header><mat-card-title><h2 class="card-title">Certificates</h2></mat-card-title></mat-card-header>
        <mat-card-content>
          <button mat-stroked-button type="button" class="btn" (click)="addCertificate()" [disabled]="busy()" data-test="add-supplier-certificate">
            <mat-icon svgIcon="plus" /> Add certificate
          </button>
          @if (supplier.certificates?.length) {
            <ul class="rows">
              @for (certificate of supplier.certificates; track certificate.id) {
                <li class="row">
                  <a [routerLink]="['/certificates', certificate.id]" class="mail">{{ name(certificate) }}</a>
                  <span class="cert-meta">
                    <span class="muted">until {{ date(certificate.expires_on) }}</span>
                    <hs-certificate-status-badge [status]="certificate.status" />
                  </span>
                </li>
              }
            </ul>
          } @else {
            <p class="muted">No certificates yet.</p>
          }
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined" class="hs-card" data-test="upload-links">
        <mat-card-header><mat-card-title><h2 class="card-title">Upload links</h2></mat-card-title></mat-card-header>
        <mat-card-content>
          <button mat-flat-button type="button" class="btn" (click)="requestCertificates()" [disabled]="busy() || supplier.ingredients.length === 0" data-test="request-certificates">Request certificates</button>
          @if (supplier.ingredients.length === 0) { <p class="muted">Link ingredients to this supplier first.</p> }
          @if (requests().length) {
            <ul class="rows">
              @for (item of requests(); track item.id) {
                <li class="row link-row">
                  <div class="link-row__main">
                    <span class="link-state link-state--{{ item.status }}">{{ item.status === 'open' ? 'Open' : item.status === 'expired' ? 'Expired' : 'Closed' }}</span>
                    <span>{{ ingredientNames(item) }}</span>
                    <span class="muted">sent {{ date(item.created_at) }} · expires {{ date(item.expires_at) }} · {{ item.uploads_count }} of {{ item.max_uploads }} uploaded</span>
                    @if (item.closed_reason) { <span class="muted">{{ reasonText[item.closed_reason] }}</span> }
                  </div>
                  @if (item.status === 'open') {
                    <button mat-button type="button" class="btn" (click)="cancelLink(item)" [disabled]="busy()">Cancel link</button>
                  }
                </li>
              }
            </ul>
          }
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: `
    :host { display: grid; gap: var(--space-4); }
    .back, .mail { display: inline-flex; align-items: center; min-height: 44px; }
    .page-top { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
    .page-top__title { font-size: var(--text-3xl); }
    .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .btn { min-height: 44px; }
    .card-title { font-size: var(--text-xl); }
    .rows { list-style: none; margin: var(--space-4) 0 0; padding: 0; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); border-top: 1px solid var(--color-border); padding-block: var(--space-1); }
    .cert-meta { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--space-2); }
    .link-row { align-items: flex-start; flex-wrap: wrap; }
    .link-row__main { display: grid; gap: var(--space-1); min-width: 0; }
    .link-state { font-size: var(--text-xs); font-weight: var(--weight-semibold); }
    .link-state--open { color: var(--color-success-fg); }
    .link-state--expired { color: var(--color-warning-fg); }
    .link-state--closed { color: var(--color-text-muted); }
    .load-error { display: grid; gap: var(--space-3); justify-items: start; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierDetailPage implements OnInit {
  readonly id = input.required<string>();

  private readonly suppliers = inject(SuppliersApi);
  private readonly ingredients = inject(IngredientsApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  protected readonly state = signal<State>({ kind: 'loading' });
  protected readonly busy = signal(false);
  protected readonly name = bodyName;
  protected readonly date = ukDate;
  private readonly uploads = inject(UploadRequestsApi);
  protected readonly requests = signal<readonly UploadRequestItem[]>([]);
  protected readonly reasonText = CLOSED_REASON_TEXT;
  protected readonly searchIngredients = (text: string): Observable<readonly NamedRef[]> => this.ingredients.search(text);

  private get supplierId(): number {
    return Number(this.id());
  }

  ngOnInit(): void {
    void this.load();
    void this.loadRequests();
  }

  async load(): Promise<void> {
    if (this.state().kind !== 'ready') {
      this.state.set({ kind: 'loading' });
    }
    try {
      this.state.set({ kind: 'ready', supplier: await firstValueFrom(this.suppliers.get(this.supplierId)) });
    } catch (error) {
      this.state.set({ kind: isNotFound(error) ? 'notFound' : 'error' });
    }
  }

  /** Encoded, so a crafted address ("a?bcc=…") cannot add hidden recipients in the mail client. */
  protected mailto(email: string): string {
    return 'mailto:' + encodeURIComponent(email);
  }

  protected ingredientIds(supplier: SupplierDetail): readonly number[] {
    return supplier.ingredients.map((i) => i.id);
  }

  protected async linkIngredient(target: LinkTarget): Promise<void> {
    await this.run(async () => {
      const supplier = await firstValueFrom(this.suppliers.linkIngredient(this.supplierId, target));
      this.state.set({ kind: 'ready', supplier });
      const name = 'name' in target ? target.name : supplier.ingredients.find((i) => i.id === target.id)?.name;
      this.notify(`${name ?? 'Ingredient'} added.`);
    }, 'The ingredient could not be added. Please try again.');
  }

  protected async unlinkIngredient(ingredient: NamedRef): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.suppliers.unlinkIngredient(this.supplierId, ingredient.id));
      await this.load();
      this.notify(`${ingredient.name} removed.`);
    }, 'The ingredient could not be removed. Please try again.');
  }

  protected async addCertificate(): Promise<void> {
    const s = this.state();
    if (s.kind !== 'ready') {
      return;
    }
    const data: CertificateDialogData = { certificate: null, supplier: { id: s.supplier.id, name: s.supplier.name } };
    const saved = await firstValueFrom(this.dialog.open<CertificateDialog, CertificateDialogData, CertificateDetail>(CertificateDialog, {
      data, autoFocus: 'first-tabbable', width: '640px', maxWidth: 'calc(100vw - 32px)',
    }).afterClosed());
    if (saved) {
      await this.load();
      this.notify('Certificate saved.');
    }
  }

  private async loadRequests(): Promise<void> {
    try {
      this.requests.set(await firstValueFrom(this.uploads.list(this.supplierId)));
    } catch {
      this.requests.set([]);
    }
  }

  protected async requestCertificates(): Promise<void> {
    const s = this.state();
    if (s.kind !== 'ready') {
      return;
    }
    const data: UploadRequestDialogData = { supplier: s.supplier, hasOpenLink: this.requests().some((r) => r.status === 'open') };
    await firstValueFrom(this.dialog.open(UploadRequestDialog, { data, autoFocus: 'first-tabbable', width: '560px', maxWidth: 'calc(100vw - 32px)' }).afterClosed());
    await this.loadRequests();
  }

  protected async cancelLink(item: UploadRequestItem): Promise<void> {
    const data: ConfirmDialogData = { title: 'Cancel this upload link?', message: 'The supplier will no longer be able to upload with it.', confirmLabel: 'Cancel link' };
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialog, { data, width: '440px', maxWidth: 'calc(100vw - 32px)' }).afterClosed());
    if (confirmed !== true) {
      return;
    }
    await this.run(async () => {
      await firstValueFrom(this.uploads.cancel(item.id));
      await this.loadRequests();
      this.notify('Upload link cancelled.');
    }, 'The link could not be cancelled. Please try again.');
  }

  protected ingredientNames(item: UploadRequestItem): string {
    return item.ingredients.map((i) => i.name).join(', ');
  }

  protected async editSupplier(supplier: SupplierDetail): Promise<void> {
    const data: SupplierDialogData = { supplier };
    const saved = await firstValueFrom(this.dialog.open<SupplierDialog, SupplierDialogData, SupplierDetail>(SupplierDialog, {
      data, autoFocus: 'first-tabbable', width: '520px', maxWidth: 'calc(100vw - 32px)',
    }).afterClosed());
    if (saved) {
      this.state.set({ kind: 'ready', supplier: saved });
      this.notify('Supplier saved.');
    }
  }

  protected async deleteSupplier(): Promise<void> {
    const s = this.state();
    const name = s.kind === 'ready' ? s.supplier.name : 'this supplier';
    const count = s.kind === 'ready' ? s.supplier.ingredients.length : 0;
    const data: ConfirmDialogData = {
      title: `Delete ${name}?`,
      message: `It is removed from ${count} ${count === 1 ? 'ingredient' : 'ingredients'}. Products and ingredients stay.`,
      confirmLabel: 'Delete supplier',
    };
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialog, { data, width: '440px', maxWidth: 'calc(100vw - 32px)' }).afterClosed());
    if (confirmed !== true) {
      return;
    }
    await this.run(async () => {
      await firstValueFrom(this.suppliers.remove(this.supplierId));
      await this.router.navigate(['/suppliers']);
      this.notify('Supplier deleted.');
    }, 'The supplier could not be deleted. Please try again.');
  }

  private async run(action: () => Promise<void>, fallback: string): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await action();
    } catch (error) {
      if (isNotFound(error)) {
        // The supplier OR a linked ingredient is gone: reload decides (not found only if the supplier was deleted).
        await this.load();
        if (this.state().kind === 'ready') {
          this.snackBar.open('Someone else changed this just now. The page is up to date again.', 'Close', { duration: 6000 });
        }
      } else {
        this.snackBar.open(errorMessage(error, fallback), 'Close', { duration: 6000 });
      }
    } finally {
      this.busy.set(false);
    }
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Close', { duration: 4000 });
  }
}
