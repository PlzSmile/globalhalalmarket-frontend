import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Observable, Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { LinkTarget, NamedRef } from '../../core/models/catalogue';
import { collapseSpaces, nameKey } from '../forms/normalise';

type Choice = NamedRef | { readonly create: string };

/** Search-and-pick autocomplete: pick an existing record or create one by name. Built once, used for all links. */
@Component({
  selector: 'hs-link-picker',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field appearance="outline" class="picker" subscriptSizing="dynamic">
      <mat-label>{{ label() }}</mat-label>
      <input matInput [formControl]="text" [matAutocomplete]="auto" (focus)="onFocus()" [attr.data-test]="testId()" autocomplete="off" />
      <mat-autocomplete #auto="matAutocomplete" [autoActiveFirstOption]="true" [displayWith]="display" (optionSelected)="select($event.option.value)">
        @for (option of options(); track option.id) {
          <mat-option [value]="option">{{ option.name }}</mat-option>
        }
        @if (createName(); as name) {
          <mat-option [value]="{ create: name }">Create "{{ name }}"</mat-option>
        }
      </mat-autocomplete>
    </mat-form-field>
  `,
  styles: `.picker { width: 100%; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkPicker {
  readonly label = input.required<string>();
  readonly search = input.required<(text: string) => Observable<readonly NamedRef[]>>();
  readonly excludeIds = input<readonly number[]>([]);
  readonly busy = input(false);
  readonly testId = input('link-picker');
  readonly picked = output<LinkTarget>();

  protected readonly text = new FormControl<string>('', { nonNullable: true });
  private readonly typed = signal('');
  private readonly results = signal<readonly NamedRef[]>([]);
  private readonly queries = new Subject<string>();

  protected readonly options = computed(() => {
    const exclude = new Set(this.excludeIds());
    return this.results().filter((r) => !exclude.has(r.id));
  });

  protected readonly createName = computed(() => {
    const name = collapseSpaces(this.typed());
    if (!name) {
      return null;
    }
    const key = nameKey(name);
    return this.results().some((r) => nameKey(r.name) === key) ? null : name;
  });

  protected readonly display = (): string => '';

  constructor() {
    this.text.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (typeof value === 'string') {
        this.typed.set(value);
        this.queries.next(value);
      }
    });
    this.queries.pipe(
      debounceTime(250),
      map((value) => collapseSpaces(value)),
      distinctUntilChanged(),
      switchMap((value) => this.search()(value).pipe(catchError(() => of([] as readonly NamedRef[])))),
      takeUntilDestroyed(),
    ).subscribe((results) => this.results.set(results));

    effect(() => (this.busy() ? this.text.disable({ emitEvent: false }) : this.text.enable({ emitEvent: false })));
  }

  protected onFocus(): void {
    this.queries.next(this.text.value);
  }

  protected select(choice: Choice): void {
    if (this.busy()) {
      return;
    }
    this.picked.emit('create' in choice ? { name: choice.create } : { id: choice.id });
    this.text.setValue('');
  }
}
