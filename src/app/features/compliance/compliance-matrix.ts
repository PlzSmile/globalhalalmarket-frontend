import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, filter, firstValueFrom, map, of, switchMap } from 'rxjs';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ComplianceApi } from '../../core/api/compliance-api';
import { SuppliersApi } from '../../core/api/suppliers-api';
import { NamedRef, Paginated } from '../../core/models/catalogue';
import { ComplianceCell, ComplianceFilters, ComplianceStatus, ProductComplianceRow, STATUS_LABELS } from '../../core/models/compliance';
import { DashboardMarket } from '../../core/models/dashboard';
import { AuthorityCode } from '../../core/models/markets';
import { collapseSpaces } from '../../shared/forms/normalise';
import { StatusBadge } from '../../shared/ui/status-badge';
import { ComplianceReasonsDialog, ComplianceReasonsDialogData } from './compliance-reasons-dialog';
import { statusDetail } from './compliance-format';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; page: Paginated<ProductComplianceRow> };

const STATUSES: readonly ComplianceStatus[] = ['red', 'amber', 'green'];
const EMPTY: ComplianceFilters = { market: null, status: null, supplier: null, search: '', page: 1 };

/** Product × market matrix. The URL holds the filters (shareable inside the team, survives reload). */
@Component({
  selector: 'hs-compliance-matrix',
  imports: [
    ReactiveFormsModule, RouterLink, MatAutocompleteModule, MatButtonModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatPaginatorModule, MatProgressBarModule, MatSelectModule, MatTableModule, StatusBadge,
  ],
  template: `
    <div class="filters">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Market</mat-label>
        <mat-select [value]="filters().market" (selectionChange)="go({ market: $event.value, page: 1 })" data-test="market-filter">
          <mat-option [value]="null">All markets</mat-option>
          @for (m of markets(); track m.code) { <mat-option [value]="m.code">{{ m.market }} · {{ m.authority }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Status</mat-label>
        <mat-select [value]="filters().status" (selectionChange)="go({ status: $event.value, page: 1 })" data-test="status-filter">
          <mat-option [value]="null">Any status</mat-option>
          @for (s of statuses; track s) { <mat-option [value]="s">{{ labels[s] }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Supplier</mat-label>
        <input matInput [formControl]="supplierInput" [matAutocomplete]="auto" maxlength="160" data-test="supplier-filter" />
        <mat-autocomplete #auto="matAutocomplete" [displayWith]="displaySupplier" (optionSelected)="setSupplier($event)">
          @for (s of supplierOptions(); track s.id) { <mat-option [value]="s">{{ s.name }}</mat-option> }
        </mat-autocomplete>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Search product or SKU</mat-label>
        <input matInput type="search" [formControl]="search" maxlength="100" data-test="search" />
      </mat-form-field>
    </div>

    @if (filters().supplier !== null) {
      <mat-chip-set aria-label="Supplier filter">
        <mat-chip [removable]="true" (removed)="go({ supplier: null, page: 1 })">
          Supplier: {{ supplierName() ?? '…' }}
          <button matChipRemove type="button" aria-label="Remove the supplier filter"><mat-icon svgIcon="close" /></button>
        </mat-chip>
      </mat-chip-set>
    }

    @let s = state();
    @if (s.kind === 'loading') {
      <mat-progress-bar mode="indeterminate" aria-label="Loading products" />
    } @else if (s.kind === 'error') {
      <div class="load-error">
        <p role="alert">We couldn't load the products.</p>
        <button mat-stroked-button type="button" class="btn" (click)="load()" data-test="retry">Try again</button>
      </div>
    } @else if (s.page.meta.total === 0) {
      <p class="muted" role="status">No products match these filters.</p>
    } @else {
      <div class="matrix-scroll">
        <table mat-table [dataSource]="s.page.data" class="hs-responsive-table matrix">
          <caption class="visually-hidden">Products and their status in each market</caption>
          <ng-container matColumnDef="product" sticky>
            <th mat-header-cell *matHeaderCellDef scope="col">Product</th>
            <td mat-cell *matCellDef="let row" class="hs-cell--primary">
              <a [routerLink]="['/products', row.id]" class="row-link">{{ row.name }}</a>
              @if (row.sku) { <span class="subtle mono"> · {{ row.sku }}</span> }
            </td>
          </ng-container>
          @for (m of markets(); track m.code) {
            <ng-container [matColumnDef]="m.code">
              <th mat-header-cell *matHeaderCellDef scope="col">{{ m.market }} · {{ m.authority }}</th>
              <td mat-cell *matCellDef="let row" [attr.data-label]="m.market + ' · ' + m.authority">
                @let c = cell(row, m.code);
                <button type="button" class="cell-button" (click)="openReasons(row, m.code)" [attr.aria-label]="'Why? ' + row.name + ' in ' + m.market" data-test="cell">
                  @if (c?.status; as status) {
                    <hs-status-badge [status]="status" [reason]="c?.reason ?? null" [detail]="detail(c)" />
                  } @else {
                    <span class="muted">Not calculated yet</span>
                  }
                </button>
              </td>
            </ng-container>
          }
          <tr mat-header-row *matHeaderRowDef="columns()"></tr>
          <tr mat-row *matRowDef="let row; columns: columns()"></tr>
        </table>
      </div>
      <mat-paginator [length]="s.page.meta.total" [pageSize]="25" [pageIndex]="filters().page - 1" [hidePageSize]="true" (page)="onPage($event)" aria-label="Choose page" />
    }
  `,
  styles: `
    :host { display: grid; gap: var(--space-3); }
    .filters { display: grid; gap: var(--space-3); grid-template-columns: minmax(0, 1fr); }
    @media (min-width: 768px) { .filters { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (min-width: 1200px) { .filters { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
    /* Tablet/desktop: the table scrolls sideways inside the card, never the page; the product column stays put. */
    .matrix-scroll { overflow-x: auto; }
    .matrix { min-width: 100%; }
    .row-link { display: inline-flex; align-items: center; min-height: 44px; font-weight: var(--weight-semibold); }
    .cell-button {
      display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; padding: var(--space-1) 0;
      background: none; border: 0; color: inherit; font: inherit; text-align: start; cursor: pointer;
    }
    .cell-button:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; border-radius: var(--radius-sm); }
    .load-error { display: grid; gap: var(--space-3); justify-items: start; }
    .btn { min-height: 44px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComplianceMatrix implements OnInit {
  readonly markets = input.required<readonly DashboardMarket[]>();

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ComplianceApi);
  private readonly suppliers = inject(SuppliersApi);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statuses = STATUSES;
  protected readonly labels = STATUS_LABELS;
  protected readonly filters = signal<ComplianceFilters>(EMPTY);
  protected readonly state = signal<State>({ kind: 'loading' });
  protected readonly supplierName = signal<string | null>(null);
  protected readonly supplierOptions = signal<readonly NamedRef[]>([]);
  protected readonly columns = computed(() => ['product', ...this.markets().map((m) => m.code)]);
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly supplierInput = new FormControl<string | NamedRef>('', { nonNullable: true });
  protected readonly displaySupplier = (value: string | NamedRef | null): string => (value && typeof value !== 'string' ? value.name : (value ?? ''));
  private latestRequest = 0;

  ngOnInit(): void {
    // Inputs are set by now, so market codes from the URL can be checked against the company's markets.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => this.fromUrl(params));
    this.search.valueChanges.pipe(debounceTime(300), map((v) => collapseSpaces(v)), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((search) => this.go({ search, page: 1 }));
    this.supplierInput.valueChanges.pipe(
      filter((v): v is string => typeof v === 'string'),
      debounceTime(300),
      map((v) => collapseSpaces(v)),
      distinctUntilChanged(),
      switchMap((text) => (text ? this.suppliers.search(text).pipe(catchError(() => of([] as readonly NamedRef[]))) : of([] as readonly NamedRef[]))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((list) => this.supplierOptions.set(list));
  }

  protected cell(row: ProductComplianceRow, market: AuthorityCode): ComplianceCell | undefined {
    return row.cells.find((c) => c.market === market);
  }

  protected detail(cell: ComplianceCell | undefined): string | null {
    return cell ? statusDetail(cell.status, cell.next_expiry_on) : null;
  }

  /** Writes the new filters to the URL; the URL change reloads the page (one source of truth). */
  protected go(patch: Partial<ComplianceFilters>): void {
    const next = { ...this.filters(), ...patch };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { market: next.market, status: next.status, supplier: next.supplier, q: next.search || null, page: next.page > 1 ? next.page : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected setSupplier(event: MatAutocompleteSelectedEvent): void {
    const supplier = event.option.value as NamedRef;
    this.supplierName.set(supplier.name);
    this.supplierInput.setValue('', { emitEvent: false });
    this.go({ supplier: supplier.id, page: 1 });
  }

  protected onPage(event: PageEvent): void {
    this.go({ page: event.pageIndex + 1 });
  }

  protected async openReasons(row: ProductComplianceRow, market: AuthorityCode): Promise<void> {
    const data: ComplianceReasonsDialogData = { productId: row.id, productName: row.name, market };
    await firstValueFrom(this.dialog.open(ComplianceReasonsDialog, { data, autoFocus: 'dialog', width: '760px', maxWidth: 'calc(100vw - 32px)' }).afterClosed());
    await this.load(); // a scope decision in the dialog may have changed the results
  }

  async load(): Promise<void> {
    const request = ++this.latestRequest;
    this.state.set({ kind: 'loading' });
    try {
      const page = await firstValueFrom(this.api.products(this.filters()));
      if (request === this.latestRequest) {
        this.state.set({ kind: 'ready', page });
      }
    } catch {
      if (request === this.latestRequest) {
        this.state.set({ kind: 'error' });
      }
    }
  }

  private fromUrl(params: ParamMap): void {
    const codes = this.markets().map((m) => m.code);
    const market = params.get('market');
    const status = params.get('status');
    const supplier = Number(params.get('supplier'));
    const page = Number(params.get('page'));
    const next: ComplianceFilters = {
      market: codes.includes(market as AuthorityCode) ? (market as AuthorityCode) : null,
      status: STATUSES.includes(status as ComplianceStatus) ? (status as ComplianceStatus) : null,
      supplier: Number.isInteger(supplier) && supplier > 0 ? supplier : null,
      search: collapseSpaces(params.get('q') ?? '').slice(0, 100),
      page: Number.isInteger(page) && page > 0 ? page : 1,
    };
    this.filters.set(next);
    this.search.setValue(next.search, { emitEvent: false });
    if (next.supplier === null) {
      this.supplierName.set(null);
    } else if (this.supplierName() === null) {
      this.suppliers.get(next.supplier).subscribe({ next: (s) => this.supplierName.set(s.name), error: () => this.go({ supplier: null, page: 1 }) });
    }
    void this.load();
  }
}
