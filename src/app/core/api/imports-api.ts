import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiItem } from '../models/auth';
import { ImportPreview, ImportResult } from '../models/imports';

@Injectable({ providedIn: 'root' })
export class ImportsApi {
  private readonly http = inject(HttpClient);

  /** Plain link (session cookie); the server sends it as a CSV attachment. */
  readonly templateUrl = '/api/v1/imports/catalogue/template';

  preview(file: File): Observable<ImportPreview> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<ApiItem<ImportPreview>>('/api/v1/imports/catalogue/preview', form).pipe(map((r) => r.data));
  }

  import(file: File, fingerprint: string): Observable<ImportResult> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('fingerprint', fingerprint);
    return this.http.post<ApiItem<ImportResult>>('/api/v1/imports/catalogue', form).pipe(map((r) => r.data));
  }
}
