import { TestBed } from '@angular/core/testing';
import { OtpInput } from './otp-input';

describe('OtpInput', () => {
  function render() {
    const fixture = TestBed.createComponent(OtpInput);
    const done: string[] = [];
    fixture.componentInstance.completed.subscribe((c) => done.push(c));
    fixture.detectChanges();
    const boxes = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('input'));
    return { fixture, boxes, done };
  }

  function type(box: HTMLInputElement, value: string): void {
    box.value = value;
    box.dispatchEvent(new Event('input'));
  }

  it('has six boxes, the first one ready for a phone to fill in the code', () => {
    const { boxes } = render();
    expect(boxes.length).toBe(6);
    expect(boxes[0].getAttribute('autocomplete')).toBe('one-time-code');
    expect(boxes[0].getAttribute('inputmode')).toBe('numeric');
  });

  it('emits the code by itself once six digits are typed, ignoring letters', () => {
    const { boxes, done } = render();
    '12345'.split('').forEach((d, i) => type(boxes[i], d));
    type(boxes[5], 'x');
    expect(done).toEqual([]);
    type(boxes[5], '6');
    expect(done).toEqual(['123456']);
  });

  it('a pasted or autofilled code fills every box', () => {
    const { boxes, done } = render();
    type(boxes[0], '987654');
    expect(boxes.map((b) => b.value).join('')).toBe('987654');
    expect(done).toEqual(['987654']);
  });
});
