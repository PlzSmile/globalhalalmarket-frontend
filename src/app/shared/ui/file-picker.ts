import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { fileSize } from '../format/uk-date';

/**
 * Pick one file. Type and size are checked here first (the server always checks again). Defaults are for
 * certificate PDFs; the catalogue import passes CSV settings.
 */
@Component({
  selector: 'hs-file-picker',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="picker">
      <input #input type="file" class="visually-hidden" [accept]="accept()" (change)="onChange(input)"
             [disabled]="disabled()" [attr.aria-label]="label()" data-test="file-input" />
      <button mat-stroked-button type="button" class="btn" (click)="input.click()" [disabled]="disabled()">
        <mat-icon svgIcon="file" /> {{ file() ? againLabel() : label() }}
      </button>
      @if (file(); as f) { <span class="picked" data-test="file-name">{{ f.name }} · {{ size(f.size) }}</span> }
      @if (error(); as message) { <p class="notice notice--error" role="alert">{{ message }}</p> }
    </div>
  `,
  styles: `
    .picker { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
    .btn { min-height: 44px; }
    .picked { color: var(--color-text-muted); font-size: var(--text-sm); word-break: break-all; }
    .notice { flex-basis: 100%; margin: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilePicker {
  readonly label = input('Choose PDF');
  readonly againLabel = input('Choose another PDF');
  readonly accept = input('.pdf,application/pdf');
  readonly extensions = input<readonly string[]>(['.pdf']);
  readonly mimeTypes = input<readonly string[]>(['application/pdf']);
  readonly typeMessage = input('Choose a PDF file.');
  readonly sizeMessage = input('The file is larger than 10 MB.');
  readonly maxBytes = input(10 * 1024 * 1024);
  readonly disabled = input(false);
  readonly fileChange = output<File | null>();

  protected readonly file = signal<File | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly size = fileSize;

  protected onChange(input: HTMLInputElement): void {
    const file = input.files?.[0] ?? null;
    input.value = '';
    this.pick(file);
  }

  pick(file: File | null): void {
    this.error.set(null);
    if (!file) {
      return;
    }
    const name = file.name.toLowerCase();
    // An empty mimeTypes list means "extension only" (browsers report CSV files under many different types).
    const types = this.mimeTypes();
    if (!this.extensions().some((ext) => name.endsWith(ext)) || (types.length > 0 && file.type !== '' && !types.includes(file.type))) {
      return this.refuse(this.typeMessage());
    }
    if (file.size === 0) {
      return this.refuse('The file is empty.');
    }
    if (file.size > this.maxBytes()) {
      return this.refuse(this.sizeMessage());
    }
    this.file.set(file);
    this.fileChange.emit(file);
  }

  /** Back to "nothing chosen" (e.g. "Choose another file"). */
  clear(): void {
    this.file.set(null);
    this.error.set(null);
  }

  private refuse(message: string): void {
    this.file.set(null);
    this.error.set(message);
    this.fileChange.emit(null);
  }
}
