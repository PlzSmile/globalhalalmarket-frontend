import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, firstValueFrom, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { CertificatesApi } from '../../core/api/certificates-api';
import { Paginated } from '../../core/models/catalogue';
import { CertificateDetail, CertificateListItem, CertificateStatus, bodyName } from '../../core/models/certificates';
import { expiryNote, ukDate } from '../../shared/format/uk-date';
import { collapseSpaces } from '../../shared/forms/normalise';
import { CertificateStatusBadge } from '../../shared/ui/certificate-status-badge';
import { EmptyState } from '../../shared/ui/empty-state';
import { CertificateDialog, CertificateDialogData } from './certificate-dialog';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; page: Paginated<CertificateListItem> };
type Filter = 'all' | CertificateStatus | 'expiring';
interface Query { readonly search: string; readonly status: CertificateStatus | null; readonly expiring: boolean; readonly page: number; }

const STATUSES: readonly CertificateStatus[] = ['approved', 'pending', 'rejected'];

@Component({
  selector: 'hs-certificates-list',
  imports: [
    ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule,
    MatPaginatorModule, MatProgressBarModule, MatTableModule, CertificateStatusBadge, EmptyState,
  ],
  template: `
    <header class="page-top">
      <h1 class="page-top__title">Certificates</h1>
      <button mat-flat-button type="button" class="btn" (click)="add()" data-test="add-certificate"><mat-icon svgIcon="plus" /> Add certificate</button>
    </header>

    <div class="filters">
      <mat-form-field appearance="outline" class="search" subscriptSizing="dynamic">
        <mat-label>Search body, number or supplier</mat-label>
        <input matInput type="search" [formControl]="search" maxlength="100" />
      </mat-form-field>
      <mat-chip-listbox aria-label="Filter certificates" [value]="activeFilter()" (change)="setFilter($event.value ?? 'all')">
        @for (f of filters; track f.value) { <mat-chip-option [value]="f.value" [selectable]="true">{{ f.label }}</mat-chip-option> }
      </mat-chip-listbox>
    </div>

    @let s = state();
    @if (s.kind === 'loading') {
      <mat-progress-bar mode="indeterminate" aria-label="Loading certificates" />
    } @else if (s.kind === 'error') {
      <mat-card appearance="outlined" class="hs-card"><mat-card-content class="load-error">
        <p role="alert">We couldn't load your certificates.</p>
        <button mat-stroked-button type="button" class="btn" (click)="load()" data-test="retry">Try again</button>
      </mat-card-content></mat-card>
    } @else if (s.page.meta.total === 0 && isUnfiltered()) {
      <hs-empty-state icon="file" heading="Add your first certificate" text="Upload your suppliers' halal certificates (PDF). We check every file before storing it.">
        <button mat-flat-button type="button" class="btn" (click)="add()">Add certificate</button>
      </hs-empty-state>
    } @else if (s.page.meta.total === 0) {
      <p class="muted" role="status">No certificates match these filters.</p>
    } @else {
      <mat-card appearance="outlined" class="hs-card table-card">
        <table mat-table [dataSource]="s.page.data" class="hs-responsive-table">
          <caption class="visually-hidden">Your certificates</caption>
          <ng-container matColumnDef="body">
            <th mat-header-cell *matHeaderCellDef scope="col">Certification body</th>
            <td mat-cell *matCellDef="let c" class="hs-cell--primary">
              <a [routerLink]="['/certificates', c.id]" class="row-link" data-test="certificate-link">{{ name(c) }}</a>
              @if (!c.body) { <span class="subtle"> · not in our list</span> }
            </td>
          </ng-container>
          <ng-container matColumnDef="supplier">
            <th mat-header-cell *matHeaderCellDef scope="col">Supplier</th>
            <td mat-cell *matCellDef="let c" data-label="Supplier">{{ c.supplier.name }}</td>
          </ng-container>
          <ng-container matColumnDef="number">
            <th mat-header-cell *matHeaderCellDef scope="col">Number</th>
            <td mat-cell *matCellDef="let c" data-label="Number" class="mono">{{ c.certificate_number ?? '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="expires">
            <th mat-header-cell *matHeaderCellDef scope="col">Expires</th>
            <td mat-cell *matCellDef="let c" data-label="Expires">
              {{ date(c.expires_on) }}
              @let note = expiry(c.expires_on);
              @if (note.text) { <span [class]="'note note--' + note.tone">{{ note.text }}</span> }
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef scope="col">Status</th>
            <td mat-cell *matCellDef="let c" data-label="Status"><hs-certificate-status-badge [status]="c.status" /></td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
        <mat-paginator [length]="s.page.meta.total" [pageSize]="25" [pageIndex]="query().page - 1" [hidePageSize]="true" (page)="onPage($event)" aria-label="Choose page" />
      </mat-card>
    }
  `,
  styles: `
    :host { display: grid; gap: var(--space-4); }
    .page-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); }
    .page-top__title { font-size: var(--text-3xl); }
    .filters { display: grid; gap: var(--space-3); }
    .search { width: min(100%, var(--container-form)); }
    .btn { min-height: 44px; }
    .table-card { overflow: hidden; }
    .row-link { display: inline-flex; align-items: center; min-height: 44px; font-weight: var(--weight-semibold); }
    .note { margin-inline-start: var(--space-2); font-size: var(--text-xs); font-weight: var(--weight-semibold); }
    .note--danger { color: var(--color-danger-fg); }
    .note--warning { color: var(--color-warning-fg); }
    .load-error { display: grid; gap: var(--space-3); justify-items: start; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificatesList implements OnInit {
  private readonly api = inject(CertificatesApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);

  protected readonly columns = ['body', 'supplier', 'number', 'expires', 'status'];
  protected readonly filters: readonly { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' }, { value: 'approved', label: 'Approved' }, { value: 'pending', label: 'Pending' },
    { value: 'rejected', label: 'Rejected' }, { value: 'expiring', label: 'Expiring within 60 days' },
  ];
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly query = signal<Query>({ search: '', status: null, expiring: false, page: 1 });
  protected readonly state = signal<State>({ kind: 'loading' });
  protected readonly name = bodyName;
  protected readonly date = ukDate;
  protected readonly expiry = (iso: string) => expiryNote(iso);
  private latestRequest = 0;

  constructor() {
    this.search.valueChanges.pipe(debounceTime(300), map((v) => collapseSpaces(v)), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((search) => this.go({ ...this.query(), search, page: 1 }));
  }

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const page = Number(params.get('page'));
    const status = params.get('status');
    this.query.set({
      search: collapseSpaces(params.get('search') ?? '').slice(0, 100),
      status: STATUSES.includes(status as CertificateStatus) ? (status as CertificateStatus) : null,
      expiring: params.get('expiring') === '1',
      page: Number.isInteger(page) && page > 0 ? page : 1,
    });
    this.search.setValue(this.query().search, { emitEvent: false });
    void this.load();
  }

  protected activeFilter(): Filter {
    const q = this.query();
    return q.expiring ? 'expiring' : (q.status ?? 'all');
  }

  protected isUnfiltered(): boolean {
    const q = this.query();
    return !q.search && !q.status && !q.expiring;
  }

  protected setFilter(filter: Filter): void {
    this.go({ ...this.query(), status: STATUSES.includes(filter as CertificateStatus) ? (filter as CertificateStatus) : null, expiring: filter === 'expiring', page: 1 });
  }

  async load(): Promise<void> {
    const request = ++this.latestRequest;
    this.state.set({ kind: 'loading' });
    try {
      const q = this.query();
      const result = await firstValueFrom(this.api.list({ search: q.search, status: q.status, supplierId: null, expiring: q.expiring, page: q.page }));
      if (request === this.latestRequest) {
        this.state.set({ kind: 'ready', page: result });
      }
    } catch {
      if (request === this.latestRequest) {
        this.state.set({ kind: 'error' });
      }
    }
  }

  protected onPage(event: PageEvent): void {
    this.go({ ...this.query(), page: event.pageIndex + 1 });
  }

  protected async add(): Promise<void> {
    const data: CertificateDialogData = { certificate: null };
    const saved = await firstValueFrom(this.dialog.open<CertificateDialog, CertificateDialogData, CertificateDetail>(CertificateDialog, {
      data, autoFocus: 'first-tabbable', width: '640px', maxWidth: 'calc(100vw - 32px)',
    }).afterClosed());
    if (saved) {
      await this.router.navigate(['/certificates', saved.id]);
    }
  }

  private go(query: Query): void {
    this.query.set(query);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { search: query.search || null, status: query.status, expiring: query.expiring ? 1 : null, page: query.page > 1 ? query.page : null },
      replaceUrl: true,
    });
    void this.load();
  }
}
