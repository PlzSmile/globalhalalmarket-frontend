import { ChangeDetectionStrategy, Component, input, model, signal } from '@angular/core';
import { COMMA, ENTER, SEMICOLON, SPACE } from '@angular/cdk/keycodes';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { isEmail } from '../../core/models/email-templates';

/**
 * Email addresses as chips (To / Cc / Bcc in the "Send email" dialog, 12 Nov 2026). Enter, comma, semicolon or space
 * adds one; a pasted list is split; a wrong address stays in the box with a message instead of becoming a chip.
 */
@Component({
  selector: 'hs-email-chips',
  imports: [MatChipsModule, MatFormFieldModule, MatIconModule],
  template: `
    <mat-form-field appearance="outline" class="chips">
      <mat-label>{{ label() }}</mat-label>
      <mat-chip-grid #grid [attr.aria-label]="label()">
        @for (email of emails(); track email) {
          <mat-chip-row (removed)="remove(email)">
            {{ email }}
            <button matChipRemove type="button" [attr.aria-label]="'Remove ' + email"><mat-icon svgIcon="close" /></button>
          </mat-chip-row>
        }
        <input [matChipInputFor]="grid" [matChipInputSeparatorKeyCodes]="separators" [matChipInputAddOnBlur]="true"
          (matChipInputTokenEnd)="add($event)" (paste)="paste($event)" type="email" inputmode="email" autocomplete="off"
          [attr.data-test]="'chips-' + label()" />
      </mat-chip-grid>
      @if (error(); as message) { <mat-hint class="chips__error" role="alert">{{ message }}</mat-hint> }
    </mat-form-field>
  `,
  styles: `
    .chips { width: 100%; }
    .chips__error { color: var(--color-danger-fg, var(--color-danger)); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailChips {
  readonly label = input.required<string>();
  readonly emails = model<readonly string[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly separators = [ENTER, COMMA, SEMICOLON, SPACE] as const;

  protected add(event: MatChipInputEvent): void {
    const value = event.value.trim();
    if (value === '') return;
    if (this.addAll([value])) event.chipInput.clear();
  }

  protected paste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') ?? '';
    const parts = text.split(/[\s,;]+/).filter(Boolean);
    if (parts.length < 2) return; // one address: the normal input handles it
    event.preventDefault();
    this.addAll(parts);
  }

  protected remove(email: string): void {
    this.emails.update((list) => list.filter((e) => e !== email));
  }

  /** Adds the good addresses; false (and a message) when one is not an email address. */
  private addAll(values: readonly string[]): boolean {
    const bad = values.find((v) => !isEmail(v));
    const good = values.filter((v) => isEmail(v)).map((v) => v.trim().toLowerCase());
    this.emails.update((list) => [...list, ...good.filter((e) => !list.includes(e))]);
    this.error.set(bad ? `"${bad}" is not an email address.` : null);
    return bad === undefined;
  }
}
