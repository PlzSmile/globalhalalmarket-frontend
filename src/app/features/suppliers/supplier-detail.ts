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
import { errorMessage, isNotFound } from '../../shared/forms/error-message';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/ui/confirm-dialog';
import { LinkPicker } from '../../shared/ui/link-picker';
import { SupplierDialog, SupplierDialogData } from './supplier-dialog';

type State = { kind: 'loading' } | { kind: 'notFound' } | { kind: 'error' } | { kind: 'ready'; supplier: SupplierDetail };

@Component({
  selector: 'hs-supplier-detail',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule, LinkPicker],
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
  protected readonly searchIngredients = (text: string): Observable<readonly NamedRef[]> => this.ingredients.search(text);

  private get supplierId(): number {
    return Number(this.id());
  }

  ngOnInit(): void {
    void this.load();
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
