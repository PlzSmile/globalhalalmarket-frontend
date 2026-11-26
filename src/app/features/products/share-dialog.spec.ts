import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Clipboard } from '@angular/cdk/clipboard';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ShareDialog } from './share-dialog';
import { ShareLinksApi } from '../../core/api/share-links-api';
import { ShareLinkItem } from '../../core/models/share-links';
import { settle } from '../../../testing/settle';

const OPEN: ShareLinkItem = { id: 4, market: 'JAKIM', expires_at: '2026-12-16T10:00:00Z', created_at: '2026-11-16T10:00:00Z', created_by: 'Bilal', views_count: 2, last_viewed_at: null };

function setup(links: readonly ShareLinkItem[] = [], confirm = true) {
  const api = {
    list: vi.fn(() => of(links)),
    create: vi.fn(() => of({ ...OPEN, id: 7, market: 'BPJPH' as const, views_count: 0, url: 'https://globalhalalmarket.test/shared/abc' })),
    link: vi.fn(() => of('https://globalhalalmarket.test/shared/old')),
    stop: vi.fn(() => of(undefined)),
  };
  const clipboard = { copy: vi.fn(() => true) };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(confirm) })) };
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { productId: 3, productName: 'Chicken Nuggets', markets: ['BPJPH', 'JAKIM'] } },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
      { provide: ShareLinksApi, useValue: api },
      { provide: Clipboard, useValue: clipboard },
      { provide: MatDialog, useValue: dialog },
    ],
  });
  const fixture = TestBed.createComponent(ShareDialog);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component = fixture.componentInstance as unknown as Record<string, any>;
  return { fixture, component, api, clipboard, dialog, el: fixture.nativeElement as HTMLElement };
}

describe('ShareDialog (Share with a buyer)', () => {
  it('lists each market: an open link with its views, the others with a create button', async () => {
    const { fixture, el } = setup([OPEN]);
    await settle(fixture);
    expect(el.querySelector('[data-test="share-JAKIM"]')?.textContent).toContain('viewed 2 times');
    expect(el.querySelector('[data-test="share-JAKIM"] [data-test="stop"]')).not.toBeNull();
    expect(el.querySelector('[data-test="share-BPJPH"] [data-test="create"]')).not.toBeNull();
  });

  it('creates a link, shows it once and copies it on request', async () => {
    const { fixture, component, api, clipboard, el } = setup();
    await settle(fixture);
    await component['create']('BPJPH');
    await settle(fixture);
    expect(api.create).toHaveBeenCalledWith(3, 'BPJPH');
    expect((el.querySelector('[data-test="share-url"]') as HTMLInputElement).value).toBe('https://globalhalalmarket.test/shared/abc');
    (el.querySelector('[data-test="copy-new"]') as HTMLButtonElement).click();
    await settle(fixture);
    expect(clipboard.copy).toHaveBeenCalledWith('https://globalhalalmarket.test/shared/abc');
    expect(el.querySelector('[data-test="copied"]')).not.toBeNull();
  });

  it('copies an existing link fetched from the server', async () => {
    const { fixture, component, api, clipboard } = setup([OPEN]);
    await settle(fixture);
    await component['copyExisting'](OPEN);
    expect(api.link).toHaveBeenCalledWith(4);
    expect(clipboard.copy).toHaveBeenCalledWith('https://globalhalalmarket.test/shared/old');
  });

  it('keeps the link when the person does not confirm', async () => {
    const { fixture, component, api } = setup([OPEN], false);
    await settle(fixture);
    await component['stop'](OPEN);
    expect(api.stop).not.toHaveBeenCalled();
  });

  it('stops the link after confirming', async () => {
    const { fixture, component, api } = setup([OPEN], true);
    await settle(fixture);
    await component['stop'](OPEN);
    expect(api.stop).toHaveBeenCalledWith(4);
  });

  it('shows the server message when the market cannot be shared, but leaves plan limits to the upgrade dialog', async () => {
    const { fixture, component, api } = setup();
    await settle(fixture);
    api.create.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'This product is not exported to this market.' } })));
    await component['create']('BPJPH');
    expect(component['error']()).toBe('This product is not exported to this market.');

    api.create.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'plan_limit', message: 'Pro plan' } })));
    component['error'].set(null);
    await component['create']('BPJPH');
    expect(component['error']()).toBeNull();
  });
});
