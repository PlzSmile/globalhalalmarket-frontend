import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { EmailComposer, PREVIEW_DELAY_MS, zoomed } from './email-composer';
import { EmailTemplatesApi } from '../../core/api/email-templates-api';
import { settle } from '../../../testing/settle';

function setup(preview = vi.fn(() => of({ subject: 'Khan Foods asks', html: '<p>Hello</p>' }))) {
  TestBed.configureTestingModule({ providers: [{ provide: EmailTemplatesApi, useValue: { preview } }] });
  const fixture = TestBed.createComponent(EmailComposer);
  fixture.componentRef.setInput('kind', 'upload_request');
  fixture.componentRef.setInput('placeholders', ['Supplier Name', 'Upload Link']);
  fixture.componentInstance.subject.set('[Your Company] asks');
  fixture.componentInstance.message.set('Hello ');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { fixture, composer: fixture.componentInstance as unknown as Record<string, any>, preview, el: fixture.nativeElement as HTMLElement };
}

describe('zoomed', () => {
  it('draws the preview a little smaller so the whole email fits', () => {
    expect(zoomed('<html><head><title>x</title></head><body></body></html>')).toBe('<html><head><title>x</title><style>html{zoom:0.8}</style></head><body></body></html>');
    expect(zoomed('<p>no head</p>', 0.5)).toBe('<style>html{zoom:0.5}</style><p>no head</p>');
  });
});

describe('EmailComposer', () => {
  afterEach(() => vi.useRealTimers());

  it('draws the preview once typing pauses (one request for quick changes)', async () => {
    vi.useFakeTimers();
    const { fixture, composer, preview, el } = setup();
    fixture.detectChanges();
    composer['message'].set('Hello [Supplier Name]');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS + 10);
    fixture.detectChanges();

    expect(preview).toHaveBeenCalledTimes(1);
    expect(preview).toHaveBeenCalledWith({ kind: 'upload_request', subject: '[Your Company] asks', message: 'Hello [Supplier Name]', supplier_id: null, ingredient_ids: [], certificate_type: 'halal' });
    expect(el.querySelector('iframe[data-test="preview"]')?.getAttribute('sandbox')).toBe('');
    expect(el.textContent).toContain('Khan Foods asks');
  });

  it('puts a placeholder where the cursor is', async () => {
    const { fixture, composer, el } = setup();
    await settle(fixture);
    const textarea = el.querySelector('textarea') as HTMLTextAreaElement;
    textarea.setSelectionRange(6, 6); // after "Hello "
    composer['target'] = 'message';
    composer['insert']('Supplier Name');
    expect(composer['message']()).toBe('Hello [Supplier Name]');
  });

  it('keeps the text when the preview fails', async () => {
    vi.useFakeTimers();
    const { fixture, composer, el } = setup(vi.fn(() => throwError(() => new Error('down'))));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS + 10);
    fixture.detectChanges();
    expect(el.textContent).toContain('The preview could not be loaded');
    expect(composer['message']()).toBe('Hello ');
  });
});
