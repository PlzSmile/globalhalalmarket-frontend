import { TestBed } from '@angular/core/testing';
import { MatIconRegistry } from '@angular/material/icon';
import { FakeMatIconRegistry } from '@angular/material/icon/testing';
import { EmailChips } from './email-chips';
import { isEmail } from '../../core/models/email-templates';
import { settle } from '../../../testing/settle';

describe('isEmail', () => {
  it('accepts normal addresses only', () => {
    expect(isEmail('quality@acme.co.uk')).toBe(true);
    expect(isEmail(' a@b.test ')).toBe(true);
    expect(isEmail('not-an-email')).toBe(false);
    expect(isEmail('a@b')).toBe(false);
    expect(isEmail('a b@c.test')).toBe(false);
  });
});

describe('EmailChips', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [{ provide: MatIconRegistry, useClass: FakeMatIconRegistry }] });
    const fixture = TestBed.createComponent(EmailChips);
    fixture.componentRef.setInput('label', 'To');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { fixture, chips: fixture.componentInstance as unknown as Record<string, any>, el: fixture.nativeElement as HTMLElement };
  }

  it('adds good addresses once, in lower case, and refuses a wrong one with a message', async () => {
    const { fixture, chips, el } = setup();
    await settle(fixture);
    const clear = () => undefined;
    chips['add']({ value: 'Q@Acme.test', chipInput: { clear } });
    chips['add']({ value: 'q@acme.test', chipInput: { clear } });
    chips['add']({ value: 'oops', chipInput: { clear } });
    fixture.detectChanges();

    expect(chips['emails']()).toEqual(['q@acme.test']);
    expect(el.textContent).toContain('"oops" is not an email address.');
  });

  it('splits a pasted list and removes a chip', async () => {
    const { fixture, chips } = setup();
    await settle(fixture);
    const event = { clipboardData: { getData: () => 'a@x.test, b@x.test; c@x.test' }, preventDefault: () => undefined } as unknown as ClipboardEvent;
    chips['paste'](event);
    expect(chips['emails']()).toEqual(['a@x.test', 'b@x.test', 'c@x.test']);
    chips['remove']('b@x.test');
    expect(chips['emails']()).toEqual(['a@x.test', 'c@x.test']);
  });
});
