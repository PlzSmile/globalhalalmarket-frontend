import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiItem } from '../models/auth';
import { DashboardData } from '../models/dashboard';

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly http = inject(HttpClient);

  get(): Observable<DashboardData> {
    return this.http.get<ApiItem<DashboardData>>('/api/v1/dashboard').pipe(map((r) => r.data));
  }
}
