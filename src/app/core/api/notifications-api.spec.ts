import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NotificationsApi } from './notifications-api';
import { NotificationPage } from '../models/notifications';

const PAGE: NotificationPage = {
  data: [{ id: 'a1', kind: 'expiry_digest', title: '1 certificate or recognition needs attention', items: [], products: [], read: false, created_at: '2026-10-07T07:00:00+01:00' }],
  meta: { current_page: 1, last_page: 1, total: 1, unread: 1 },
};

describe('NotificationsApi', () => {
  let api: NotificationsApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(NotificationsApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('lists, marks one and marks all as read', () => {
    let page: NotificationPage | null = null;
    api.list().subscribe((p) => (page = p));
    backend.expectOne({ method: 'GET', url: '/api/v1/notifications' }).flush(PAGE);
    expect(page).toEqual(PAGE);

    api.read('a1').subscribe();
    backend.expectOne({ method: 'POST', url: '/api/v1/notifications/a1/read' }).flush(null);
    api.readAll().subscribe();
    backend.expectOne({ method: 'POST', url: '/api/v1/notifications/read-all' }).flush(null);
  });
});
