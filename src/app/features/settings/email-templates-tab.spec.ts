import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { EmailTemplatesTab } from './email-templates-tab';
import { EmailTemplatesApi } from '../../core/api/email-templates-api';
import { EmailTemplate } from '../../core/models/email-templates';
import { settle } from '../../../testing/settle';

const REQUEST: EmailTemplate = { kind: 'upload_request', label: 'Certificate request', subject: 'Default subject', message: 'Default message', is_default: true, placeholders: ['Supplier Name'] };
const CHASE: EmailTemplate = { kind: 'renewal_chase', label: 'Renewal reminder (sent automatically)', subject: 'Chase subject', message: 'Chase message', is_default: true, placeholders: ['Certificate Expiry Date'] };

function setup() {
  const save = vi.fn((_kind: string, subject: string, message: string) => of({ ...REQUEST, subject, message, is_default: false }));
  const reset = vi.fn(() => of(REQUEST));
  const snackBar = { open: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: EmailTemplatesApi, useValue: { list: () => of([REQUEST, CHASE]), save, reset, preview: () => of({ subject: 's', html: '<p>x</p>' }) } },
      { provide: MatSnackBar, useValue: snackBar },
    ],
  });
  const fixture = TestBed.createComponent(EmailTemplatesTab);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { fixture, tab: fixture.componentInstance as unknown as Record<string, any>, save, reset, snackBar, el: fixture.nativeElement as HTMLElement };
}

describe('EmailTemplatesTab', () => {
  it('saves the customer wording, then offers to reset it', async () => {
    const { fixture, tab, save, reset, el } = setup();
    await settle(fixture);
    expect(el.textContent).toContain('This is our default wording.');
    expect(el.querySelector('[data-test="reset-template"]')).toBeNull();

    tab['subject'].set('  My subject ');
    tab['message'].set('My message');
    await tab['save']();
    await settle(fixture);
    expect(save).toHaveBeenCalledWith('upload_request', 'My subject', 'My message');
    expect(el.querySelector('[data-test="reset-template"]')).not.toBeNull();

    await tab['reset']();
    await settle(fixture);
    expect(reset).toHaveBeenCalledWith('upload_request');
    expect(tab['subject']()).toBe('Default subject');
  });

  it('switches to the renewal reminder and refuses an empty message', async () => {
    const { fixture, tab, save, el } = setup();
    await settle(fixture);
    tab['choose']('renewal_chase');
    await settle(fixture);
    expect(tab['subject']()).toBe('Chase subject');

    tab['message'].set('   ');
    await tab['save']();
    fixture.detectChanges();
    expect(save).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Enter a subject and a message.');
  });
});
