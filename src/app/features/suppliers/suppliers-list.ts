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
import { SuppliersApi } from '../../core/api/suppliers-api';
import { Paginated, SupplierDetail, SupplierListItem } from '../../core/models/catalogue';
import { collapseSpaces } from '../../shared/forms/normalise';
import { EmptyState } from '../../shared/ui/empty-state';
import { SupplierDialog, SupplierDialogData } from './supplier-dialog';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; page: Paginated<SupplierListItem> };

@Component({
  selector: 'hs-suppliers-list',
  imports: [
    ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatPaginatorModule, MatProgressBarModule, MatTableModule, EmptyState,
  ],
  template: `
    <header class="page-top">
      <h1 class="page-top__title">Suppliers</h1>
      <button mat-flat-button type="button" class="btn" (click)="add()" data-test="add-supplier"><mat-icon svgIcon="plus" /> Add supplier</button>
    </header>

    <mat-form-field appearance="outline" class="search" subscriptSizing="dynamic">
      <mat-label>Search by name</mat-label>
      <input matInput type="search" [formControl]="search" maxlength="100" data-test="search" />
    </mat-form-field>

    @let s = state();
    @if (s.kind === 'loading') {
      <mat-progress-bar mode="indeterminate" aria-label="Loading suppliers" />
    } @else if (s.kind === 'error') {
      <mat-card appearance="outlined" class="hs-card"><mat-card-content class="load-error">
        <p role="alert">We couldn't load your suppliers.</p>
        <button mat-stroked-button type="button" class="btn" (click)="load()" data-test="retry">Try again</button>
      </mat-card-content></mat-card>
    } @else if (s.page.meta.total === 0 && !query().search) {
      <hs-empty-state icon="truck" heading="Add your first supplier" text="Record who supplies your ingredients, so certificates can be requested from them.">
        <button mat-flat-button type="button" class="btn" (click)="add()">Add supplier</button>
      </hs-empty-state>
    } @else if (s.page.meta.total === 0) {
      <p class="muted" role="status">No suppliers match "{{ query().search }}".
        <button mat-button type="button" class="btn" (click)="search.setValue('')">Clear search</button></p>
    } @else {
      <mat-card appearance="outlined" class="hs-card table-card">
        <table mat-table [dataSource]="s.page.data" class="hs-responsive-table">
          <caption class="visually-hidden">Your suppliers</caption>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef scope="col">Supplier</th>
            <td mat-cell *matCellDef="let supplier" class="hs-cell--primary">
              <a [routerLink]="['/suppliers', supplier.id]" class="row-link" data-test="supplier-link">{{ supplier.name }}</a>
            </td>
          </ng-container>
          <ng-container matColumnDef="country">
            <th mat-header-cell *matHeaderCellDef scope="col">Country</th>
            <td mat-cell *matCellDef="let supplier" data-label="Country">{{ supplier.country?.name ?? '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="ingredients">
            <th mat-header-cell *matHeaderCellDef scope="col">Ingredients</th>
            <td mat-cell *matCellDef="let supplier" data-label="Ingredients">{{ supplier.ingredients_count }}</td>
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
export class SuppliersList implements OnInit {
  private readonly api = inject(SuppliersApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);

  protected readonly columns = ['name', 'country', 'ingredients'];
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
    const data: SupplierDialogData = { supplier: null };
    const ref = this.dialog.open<SupplierDialog, SupplierDialogData, SupplierDetail>(SupplierDialog, {
      data, autoFocus: 'first-tabbable', width: '520px', maxWidth: 'calc(100vw - 32px)',
    });
    const saved = await firstValueFrom(ref.afterClosed());
    if (saved) {
      await this.router.navigate(['/suppliers', saved.id]);
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
