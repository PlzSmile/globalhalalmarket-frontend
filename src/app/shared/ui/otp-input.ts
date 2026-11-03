import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, signal, viewChildren } from '@angular/core';

/**
 * Six boxes for a one-time code (3 Nov 2026). Typing moves to the next box, Backspace goes back, a pasted or
 * autofilled code fills every box. When all six digits are there it emits `completed` by itself, so nobody has to
 * press a button (the page still shows one). `error` shakes the boxes and clears them for a new try.
 */
@Component({
  selector: 'hs-otp-input',
  template: `
    <div class="otp" role="group" [attr.aria-label]="label()" [class.otp--error]="error()" [class.otp--shake]="shake()">
      @for (i of slots; track i) {
        <input #box class="otp__box" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6"
               [attr.autocomplete]="i === 0 ? 'one-time-code' : 'off'" [attr.aria-label]="'Digit ' + (i + 1) + ' of 6'"
               placeholder=" " [value]="digits()[i]" [disabled]="disabled()" [attr.data-test]="'otp-' + i"
               (input)="onInput(i, $event)" (keydown)="onKey(i, $event)" (paste)="onPaste($event)" (focus)="select($event)" />
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .otp { display: grid; grid-template-columns: repeat(6, minmax(0, 3.25rem)); gap: var(--space-2); justify-content: center; }
    .otp__box {
      box-sizing: border-box; width: 100%; height: 3.5rem; text-align: center;
      font: var(--weight-semibold) 1.5rem/1 var(--font-sans); font-variant-numeric: tabular-nums; color: var(--color-text);
      border: 1.5px solid var(--color-border-strong); border-radius: var(--radius-md); background: var(--color-surface);
      caret-color: var(--color-primary);
      transition: border-color var(--duration-base) var(--ease-standard), box-shadow var(--duration-base) var(--ease-standard), transform var(--duration-fast) var(--ease-standard);
    }
    .otp__box:focus { outline: none; border-color: var(--color-primary); box-shadow: var(--ring); transform: translateY(-1px); }
    .otp__box:not(:placeholder-shown):not(:focus) { border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border-strong)); }
    .otp__box:disabled { opacity: 0.6; }
    .otp--error .otp__box { border-color: var(--color-danger-fg); }
    .otp--shake { animation: hs-otp-shake 360ms var(--ease-standard); }
    @keyframes hs-otp-shake { 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
    @media (max-width: 380px) { .otp { gap: var(--space-1); } .otp__box { height: 3rem; font-size: 1.25rem; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OtpInput {
  readonly label = input('Six-digit code');
  readonly disabled = input(false);
  /** Set by the page after a wrong code: the boxes shake and empty. */
  readonly error = input(false);
  readonly completed = output<string>();
  /** Every change (the page enables its Verify button with 6 digits). */
  readonly changed = output<string>();

  protected readonly slots = [0, 1, 2, 3, 4, 5];
  protected readonly digits = signal<string[]>(['', '', '', '', '', '']);
  protected readonly shake = signal(false);
  private readonly boxes = viewChildren<ElementRef<HTMLInputElement>>('box');

  constructor() {
    effect(() => {
      if (this.error()) {
        this.shake.set(true);
        setTimeout(() => this.shake.set(false), 400);
        this.clear();
      }
    });
  }

  /** Empty the boxes and put the cursor in the first one. */
  clear(): void {
    this.digits.set(['', '', '', '', '', '']);
    this.changed.emit('');
    setTimeout(() => this.focus(0));
  }

  focus(index = 0): void {
    this.boxes()[index]?.nativeElement.focus();
  }

  protected onInput(index: number, event: Event): void {
    const el = event.target as HTMLInputElement;
    const typed = el.value.replace(/\D/g, '');
    if (typed.length > 1) {
      this.fill(index, typed); // autofill or a fast typist: spread the digits
      return;
    }
    this.set(index, typed);
    el.value = typed;
    if (typed) {
      this.focus(Math.min(index + 1, 5));
    }
  }

  protected onKey(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digits()[index] && index > 0) {
      event.preventDefault();
      this.set(index - 1, '');
      this.focus(index - 1);
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.focus(index - 1);
    } else if (event.key === 'ArrowRight' && index < 5) {
      event.preventDefault();
      this.focus(index + 1);
    }
  }

  protected onPaste(event: ClipboardEvent): void {
    const pasted = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
    if (pasted) {
      event.preventDefault();
      this.fill(0, pasted);
    }
  }

  protected select(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  private fill(from: number, value: string): void {
    const next = [...this.digits()];
    for (let i = 0; i < value.length && from + i < 6; i++) {
      next[from + i] = value[i];
    }
    this.digits.set(next);
    this.boxes().forEach((b, i) => (b.nativeElement.value = next[i]));
    this.focus(Math.min(from + value.length, 5));
    this.emit();
  }

  private set(index: number, value: string): void {
    const next = [...this.digits()];
    next[index] = value;
    this.digits.set(next);
    this.emit();
  }

  private emit(): void {
    const code = this.digits().join('');
    this.changed.emit(code);
    if (/^\d{6}$/.test(code)) {
      this.completed.emit(code);
    }
  }
}
