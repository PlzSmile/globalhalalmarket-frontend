import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { startWith } from 'rxjs';

/**
 * The list pages' search box (3 Nov 2026): a search icon in front and a round clear (×) button once something is typed.
 * The page owns the FormControl (debounce, URL); this only draws it.
 */
@Component({
  selector: 'hs-search-field',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <mat-form-field appearance="outline" class="search" subscriptSizing="dynamic">
      <mat-icon matPrefix svgIcon="search" class="search__icon" aria-hidden="true" />
      <mat-label>{{ label() }}</mat-label>
      <input matInput type="search" [formControl]="control()" maxlength="100" data-test="search" />
      @if (value()) {
        <button matSuffix mat-icon-button type="button" class="search__clear" (click)="control().setValue('')" aria-label="Clear search" data-test="clear-search">
          <mat-icon svgIcon="close" />
        </button>
      }
    </mat-form-field>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .search { width: 100%; }
    .search__icon { width: 18px; height: 18px; margin-inline: var(--space-3) var(--space-1); color: var(--color-text-subtle); }
    .search__clear { margin-inline-end: var(--space-1); --mat-icon-button-state-layer-size: 32px; width: 32px; height: 32px; padding: 6px;
      border-radius: 50%; background: var(--color-surface-muted); color: var(--color-text-muted);
      transition: background-color var(--duration-base) var(--ease-standard), color var(--duration-base) var(--ease-standard); }
    .search__clear:hover { background: var(--color-danger-bg); color: var(--color-danger-fg); }
    .search__clear mat-icon { width: 16px; height: 16px; }
    /* The browser's own clear cross would sit next to ours. */
    input[type='search']::-webkit-search-cancel-button { display: none; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchField implements OnInit {
  readonly control = input.required<FormControl<string>>();
  readonly label = input('Search');

  private readonly destroyRef = inject(DestroyRef);
  protected readonly value = signal('');

  ngOnInit(): void {
    const control = this.control();
    control.valueChanges.pipe(startWith(control.value), takeUntilDestroyed(this.destroyRef)).subscribe((v) => this.value.set(v));
  }
}
