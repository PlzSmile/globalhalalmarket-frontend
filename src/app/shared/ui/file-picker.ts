import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { fileSize } from '../format/uk-date';

/** Pick one PDF: type and size are checked here first (the server checks again, and scans it). Reused by 5b. */
@Component({
  selector: 'hs-file-picker',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="picker">
      <input #input type="file" class="visually-hidden" accept=".pdf,application/pdf" (change)="onChange(input)"
             [disabled]="disabled()" [attr.aria-label]="label()" data-test="file-input" />
      <button mat-stroked-button type="button" class="btn" (click)="input.click()" [disabled]="disabled()">
        <mat-icon svgIcon="file" /> {{ file() ? 'Choose another PDF' : label() }}
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
    if (!file.name.toLowerCase().endsWith('.pdf') || (file.type !== '' && file.type !== 'application/pdf')) {
      return this.refuse('Choose a PDF file.');
    }
    if (file.size === 0) {
      return this.refuse('The file is empty.');
    }
    if (file.size > this.maxBytes()) {
      return this.refuse('The file is larger than 10 MB.');
    }
    this.file.set(file);
    this.fileChange.emit(file);
  }

  private refuse(message: string): void {
    this.file.set(null);
    this.error.set(message);
    this.fileChange.emit(null);
  }
}
