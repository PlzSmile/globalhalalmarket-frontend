import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotificationsBell } from './notifications-bell';
import { NotificationsApi } from '../../core/api/notifications-api';
import { NotificationPage } from '../../core/models/notifications';
import { settle } from '../../../testing/settle';

const PAGE: NotificationPage = {
  data: [
    { id: 'a1', kind: 'expiry_digest', title: '2 certificates or recognitions need attention', read: false, created_at: '2026-10-07T07:00:00+01:00', products: [],
      items: [{ kind: 'certificate', id: 9, days: 30, date: '6 Nov 2026', title: 'Acme Gelatin certificate (HFC) expires in 30 days', url: '/app/certificates/9' }] },
    { id: 'b2', kind: 'recognition_lost', title: '1 product is now red after an official list changed', read: true, created_at: '2026-10-06T09:00:00+01:00', items: [],
      products: [{ name: 'Beef sausage', market: 'JAKIM' }] },
  ],
  meta: { current_page: 1, last_page: 1, total: 2, unread: 1 },
};

function setup() {
  const api = { list: vi.fn(() => of(PAGE)), read: vi.fn(() => of(undefined)), readAll: vi.fn(() => of(undefined)) };
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: NotificationsApi, useValue: api }] });
  const fixture = TestBed.createComponent(NotificationsBell);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bell = fixture.componentInstance as unknown as Record<string, any>;
  return { fixture, api, bell, el: fixture.nativeElement as HTMLElement };
}

describe('NotificationsBell', () => {
  it('shows how many are unread in its label', async () => {
    const { fixture, el } = setup();
    await settle(fixture);
    expect(el.querySelector('button')?.getAttribute('aria-label')).toBe('Notifications, 1 unread');
  });

  it('lists the notifications with their details', async () => {
    const { fixture, bell } = setup();
    await settle(fixture);
    expect(bell['page']().data.length).toBe(2);
    expect(bell['summary'](PAGE.data[0])).toEqual(['Acme Gelatin certificate (HFC) expires in 30 days (6 Nov 2026)']);
    expect(bell['summary'](PAGE.data[1])).toEqual(['Beef sausage — JAKIM']);
  });

  it('marks one or all as read and updates the count', async () => {
    const { fixture, api, bell } = setup();
    await settle(fixture);

    await bell['open'](PAGE.data[0]);
    expect(api.read).toHaveBeenCalledWith('a1');
    expect(bell['unread']()).toBe(0);

    await bell['markAllRead']();
    expect(api.readAll).toHaveBeenCalled();
  });

  it('does not mark an already read one again', async () => {
    const { fixture, api, bell } = setup();
    await settle(fixture);
    await bell['open'](PAGE.data[1]);
    expect(api.read).not.toHaveBeenCalled();
  });

  it('refreshes every two minutes and when the tab comes back into view', async () => {
    vi.useFakeTimers();
    try {
      const { fixture, api } = setup();
      fixture.detectChanges();
      expect(api.list).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(120_000);
      expect(api.list).toHaveBeenCalledTimes(2);

      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(api.list).toHaveBeenCalledTimes(3);

      fixture.destroy();
      vi.advanceTimersByTime(240_000);
      expect(api.list).toHaveBeenCalledTimes(3); // stops when the bell is gone (logged out)
    } finally {
      vi.useRealTimers();
    }
  });
});

