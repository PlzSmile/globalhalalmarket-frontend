import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NotificationPage } from '../models/notifications';

/** Phase 6b: the signed-in user's notifications (the bell). */
@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<NotificationPage> {
    return this.http.get<NotificationPage>('/api/v1/notifications');
  }

  read(id: string): Observable<void> {
    return this.http.post<void>(`/api/v1/notifications/${encodeURIComponent(id)}/read`, null);
  }

  readAll(): Observable<void> {
    return this.http.post<void>('/api/v1/notifications/read-all', null);
  }
}
