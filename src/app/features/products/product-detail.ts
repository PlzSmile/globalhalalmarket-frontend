import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ComplianceApi } from '../../core/api/compliance-api';
import { IngredientsApi } from '../../core/api/ingredients-api';
import { ProductsApi } from '../../core/api/products-api';
import { SuppliersApi } from '../../core/api/suppliers-api';
import { AuthService } from '../../core/auth/auth.service';
import { LinkTarget, NamedRef, ProductDetail, ProductIngredient } from '../../core/models/catalogue';
import { MarketBreakdown } from '../../core/models/compliance';
import { errorMessage, isNotFound } from '../../shared/forms/error-message';
import { daysUntil, ukDate } from '../../shared/format/uk-date';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/ui/confirm-dialog';
import { LinkPicker } from '../../shared/ui/link-picker';
import { NameDialog, NameDialogData } from '../../shared/ui/name-dialog';
import { ComplianceBreakdown } from '../compliance/compliance-breakdown';
import { ComplianceHistory } from '../compliance/compliance-history';
import { ProductDialog, ProductDialogData } from './product-dialog';

type State = { kind: 'loading' } | { kind: 'notFound' } | { kind: 'error' } | { kind: 'ready'; product: ProductDetail };

@Component({
  selector: 'hs-product-detail',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatChipsModule, MatIconModule, MatMenuModule, MatProgressBarModule, LinkPicker, ComplianceBreakdown, ComplianceHistory],
  templateUrl: './product-detail.html',
  styles: `
    :host { display: grid; gap: var(--space-4); }
    .back { display: inline-flex; align-items: center; min-height: 44px; }
    .page-top { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
    .page-top__title { font-size: var(--text-3xl); }
    .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .btn { min-height: 44px; }
    .card-title { font-size: var(--text-xl); }
    .ingredients { list-style: none; margin: var(--space-4) 0 0; padding: 0; display: grid; }
    .ingredient { display: grid; gap: var(--space-2); padding-block: var(--space-3); border-top: 1px solid var(--color-border); }
    .ingredient__top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
    .ingredient__name { font-weight: var(--weight-semibold); }
    .ingredient__meta { color: var(--color-text-subtle); font-size: var(--text-sm); margin: 0; }
    .ingredient__cert--expired { color: var(--color-danger-fg); }
    .load-error { display: grid; gap: var(--space-3); justify-items: start; }
    .compliance-error { display: grid; gap: var(--space-3); justify-items: start; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailPage implements OnInit {
  readonly id = input.required<string>();

  private readonly products = inject(ProductsApi);
  private readonly ingredients = inject(IngredientsApi);
  private readonly suppliers = inject(SuppliersApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  protected readonly state = signal<State>({ kind: 'loading' });
  protected readonly busy = signal(false);
  protected readonly auth = inject(AuthService);
  private readonly compliance = inject(ComplianceApi);
  protected readonly numericId = computed(() => Number(this.id()));
  protected readonly breakdown = signal<{ kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; markets: readonly MarketBreakdown[] }>({ kind: 'loading' });
  protected readonly complianceVersion = signal(0);

  constructor() {
    // Every successful load or change of the product recalculated compliance on the server: refresh the card.
    effect(() => {
      if (this.state().kind === 'ready') {
        untracked(() => void this.loadCompliance());
      }
    });
  }

  async loadCompliance(): Promise<void> {
    try {
      this.breakdown.set({ kind: 'ready', markets: await firstValueFrom(this.compliance.product(this.numericId())) });
      this.complianceVersion.update((v) => v + 1);
    } catch {
      this.breakdown.set({ kind: 'error' });
    }
  }
  protected readonly searchIngredients = (text: string): Observable<readonly NamedRef[]> => this.ingredients.search(text);
  protected readonly searchSuppliers = (text: string): Observable<readonly NamedRef[]> => this.suppliers.search(text);

  private get productId(): number {
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
      this.state.set({ kind: 'ready', product: await firstValueFrom(this.products.get(this.productId)) });
    } catch (error) {
      this.state.set({ kind: isNotFound(error) ? 'notFound' : 'error' });
    }
  }

  /** Information only — the red/amber/green rules come in Phase 6. */
  protected certificateText(ingredient: ProductIngredient): string {
    const certificate = ingredient.certificate;
    if (!certificate) {
      return 'No approved certificate';
    }
    return this.certificateExpired(ingredient)
      ? `Certificate expired on ${ukDate(certificate.expires_on)}`
      : `Certified until ${ukDate(certificate.expires_on)}`;
  }

  protected certificateExpired(ingredient: ProductIngredient): boolean {
    return !!ingredient.certificate && daysUntil(ingredient.certificate.expires_on) < 0;
  }

  protected ingredientIds(product: ProductDetail): readonly number[] {
    return product.ingredients.map((i) => i.id);
  }

  protected supplierIds(ingredient: ProductIngredient): readonly number[] {
    return ingredient.suppliers.map((s) => s.id);
  }

  protected async linkIngredient(target: LinkTarget): Promise<void> {
    await this.run(async () => {
      const product = await firstValueFrom(this.products.linkIngredient(this.productId, target));
      this.state.set({ kind: 'ready', product });
      const name = 'name' in target ? target.name : product.ingredients.find((i) => i.id === target.id)?.name;
      this.notify(`${name ?? 'Ingredient'} added.`);
    }, 'The ingredient could not be added. Please try again.');
  }

  protected async unlinkIngredient(ingredient: ProductIngredient): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.products.unlinkIngredient(this.productId, ingredient.id));
      await this.load();
      this.notify(`${ingredient.name} removed from this product.`);
    }, 'The ingredient could not be removed. Please try again.');
  }

  protected async linkSupplier(ingredient: ProductIngredient, target: LinkTarget): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.ingredients.linkSupplier(ingredient.id, target));
      await this.load();
      this.notify(`${'name' in target ? target.name : 'Supplier'} added to ${ingredient.name}.`);
    }, 'The supplier could not be added. Please try again.');
  }

  protected async unlinkSupplier(ingredient: ProductIngredient, supplier: NamedRef): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.ingredients.unlinkSupplier(ingredient.id, supplier.id));
      await this.load();
      this.notify(`${supplier.name} removed from ${ingredient.name}.`);
    }, 'The supplier could not be removed. Please try again.');
  }

  protected async renameIngredient(ingredient: ProductIngredient): Promise<void> {
    const data: NameDialogData = {
      title: 'Rename ingredient', label: 'Ingredient name', value: ingredient.name, maxLength: 120,
      save: (name) => this.ingredients.rename(ingredient.id, name),
    };
    const renamed = await firstValueFrom(this.dialog.open(NameDialog, { data, width: '440px', maxWidth: 'calc(100vw - 32px)' }).afterClosed());
    if (renamed) {
      await this.load();
      this.notify('Ingredient renamed.');
    }
  }

  protected async deleteIngredient(ingredient: ProductIngredient): Promise<void> {
    const count = ingredient.products_count;
    const confirmed = await this.confirm({
      title: `Delete ${ingredient.name}?`,
      message: `It is used in ${count} ${count === 1 ? 'product' : 'products'}; it will be removed from all of them and from its suppliers.`,
      confirmLabel: 'Delete ingredient',
    });
    if (!confirmed) {
      return;
    }
    await this.run(async () => {
      await firstValueFrom(this.ingredients.remove(ingredient.id));
      await this.load();
      this.notify(`${ingredient.name} deleted.`);
    }, 'The ingredient could not be deleted. Please try again.');
  }

  protected async editProduct(product: ProductDetail): Promise<void> {
    const data: ProductDialogData = { product };
    const saved = await firstValueFrom(this.dialog.open<ProductDialog, ProductDialogData, ProductDetail>(ProductDialog, {
      data, autoFocus: 'first-tabbable', width: '520px', maxWidth: 'calc(100vw - 32px)',
    }).afterClosed());
    if (saved) {
      this.state.set({ kind: 'ready', product: saved });
      this.notify('Product saved.');
    }
  }

  protected async deleteProduct(): Promise<void> {
    const s = this.state();
    const name = s.kind === 'ready' ? s.product.name : 'this product';
    const confirmed = await this.confirm({
      title: `Delete ${name}?`,
      message: 'Its ingredient links are removed. Ingredients and suppliers stay.',
      confirmLabel: 'Delete product',
    });
    if (!confirmed) {
      return;
    }
    await this.run(async () => {
      await firstValueFrom(this.products.remove(this.productId));
      await this.router.navigate(['/products']);
      this.notify('Product deleted.');
    }, 'The product could not be deleted. Please try again.');
  }

  /** One action at a time; 404 means the product (or a linked record) is gone → show "not found". */
  private async run(action: () => Promise<void>, fallback: string): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      await action();
    } catch (error) {
      if (isNotFound(error)) {
        // The product OR a linked ingredient/supplier is gone: reload decides (load() shows "not found" only if
        // the product itself was deleted).
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

  private async confirm(data: ConfirmDialogData): Promise<boolean> {
    return (await firstValueFrom(this.dialog.open(ConfirmDialog, { data, width: '440px', maxWidth: 'calc(100vw - 32px)' }).afterClosed())) === true;
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Close', { duration: 4000 });
  }
}
