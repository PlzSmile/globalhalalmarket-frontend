import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, firstValueFrom, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { ProductsApi } from '../../core/api/products-api';
import { Paginated, ProductDetail, ProductListItem } from '../../core/models/catalogue';
import { collapseSpaces } from '../../shared/forms/normalise';
import { EmptyState } from '../../shared/ui/empty-state';
import { ProductDialog, ProductDialogData } from './product-dialog';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; page: Paginated<ProductListItem> };

@Component({
  selector: 'hs-products-list',
  imports: [
    ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatPaginatorModule, MatProgressBarModule, MatTableModule, EmptyState,
  ],
  template: `
    <header class="page-top">
      <h1 class="page-top__title">Products</h1>
      <button mat-flat-button type="button" class="btn" (click)="add()" data-test="add-product"><mat-icon svgIcon="plus" /> Add product</button>
    </header>

    <mat-form-field appearance="outline" class="search" subscriptSizing="dynamic">
      <mat-label>Search by name or SKU</mat-label>
      <input matInput type="search" [formControl]="search" maxlength="100" data-test="search" />
    </mat-form-field>

    @let s = state();
    @if (s.kind === 'loading') {
      <mat-progress-bar mode="indeterminate" aria-label="Loading products" />
    } @else if (s.kind === 'error') {
      <mat-card appearance="outlined" class="hs-card"><mat-card-content class="load-error">
        <p role="alert">We couldn't load your products.</p>
        <button mat-stroked-button type="button" class="btn" (click)="load()" data-test="retry">Try again</button>
      </mat-card-content></mat-card>
    } @else if (s.page.meta.total === 0 && !query().search) {
      <hs-empty-state icon="box" heading="Add your first product" text="List the products you export. Then add their ingredients and who supplies them.">
        <button mat-flat-button type="button" class="btn" (click)="add()">Add product</button>
      </hs-empty-state>
    } @else if (s.page.meta.total === 0) {
      <p class="muted" role="status">No products match "{{ query().search }}".
        <button mat-button type="button" class="btn" (click)="search.setValue('')">Clear search</button></p>
    } @else {
      <mat-card appearance="outlined" class="hs-card table-card">
        <table mat-table [dataSource]="s.page.data" class="hs-responsive-table">
          <caption class="visually-hidden">Your products</caption>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef scope="col">Product</th>
            <td mat-cell *matCellDef="let p" class="hs-cell--primary">
              <a [routerLink]="['/products', p.id]" class="row-link" data-test="product-link">{{ p.name }}</a>
              @if (p.sku) { <span class="subtle mono"> · {{ p.sku }}</span> }
            </td>
          </ng-container>
          <ng-container matColumnDef="ingredients">
            <th mat-header-cell *matHeaderCellDef scope="col">Ingredients</th>
            <td mat-cell *matCellDef="let p" data-label="Ingredients">{{ p.ingredients_count }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
        <mat-paginator [length]="s.page.meta.total" [pageSize]="25" [pageIndex]="query().page - 1" [hidePageSize]="true"
                       (page)="onPage($event)" aria-label="Choose page" />
      </mat-card>
    }
  `,
  styles: `
    :host { display: grid; gap: var(--space-4); }
    .page-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); }
    .page-top__title { font-size: var(--text-3xl); }
    .search { width: min(100%, var(--container-form)); }
    .btn { min-height: 44px; }
    .table-card { overflow: hidden; }
    .row-link { display: inline-flex; align-items: center; min-height: 44px; font-weight: var(--weight-semibold); }
    .load-error { display: grid; gap: var(--space-3); justify-items: start; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsList implements OnInit {
  private readonly api = inject(ProductsApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);

  protected readonly columns = ['name', 'ingredients'];
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly query = signal({ search: '', page: 1 });
  protected readonly state = signal<State>({ kind: 'loading' });

  constructor() {
    this.search.valueChanges.pipe(
      debounceTime(300),
      map((value) => collapseSpaces(value)),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe((search) => this.go({ search, page: 1 }));
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const page = Number(params.get('page'));
    const search = collapseSpaces(params.get('search') ?? '').slice(0, 100);
    this.query.set({ search, page: Number.isInteger(page) && page > 0 ? page : 1 });
    this.search.setValue(search, { emitEvent: false });
    void this.load();
  }

  async load(): Promise<void> {
    this.state.set({ kind: 'loading' });
    try {
      const { search, page } = this.query();
      this.state.set({ kind: 'ready', page: await firstValueFrom(this.api.list(search, page)) });
    } catch {
      this.state.set({ kind: 'error' });
    }
  }

  protected onPage(event: PageEvent): void {
    this.go({ ...this.query(), page: event.pageIndex + 1 });
  }

  protected async add(): Promise<void> {
    const data: ProductDialogData = { product: null };
    const ref = this.dialog.open<ProductDialog, ProductDialogData, ProductDetail>(ProductDialog, {
      data, autoFocus: 'first-tabbable', width: '520px', maxWidth: 'calc(100vw - 32px)',
    });
    const saved = await firstValueFrom(ref.afterClosed());
    if (saved) {
      await this.router.navigate(['/products', saved.id]);
    }
  }

  private go(query: { search: string; page: number }): void {
    this.query.set(query);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { search: query.search || null, page: query.page > 1 ? query.page : null },
      replaceUrl: true,
    });
    void this.load();
  }
}
