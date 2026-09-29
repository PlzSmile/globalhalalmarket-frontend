import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEventType, HttpParams } from '@angular/common/http';
import { Observable, filter, map } from 'rxjs';
import { ApiItem } from '../models/auth';
import { Paginated } from '../models/catalogue';
import { CertificateDetail, CertificateFields, CertificateFilters, CertificateListItem, DownloadLink, UploadEvent } from '../models/certificates';

@Injectable({ providedIn: 'root' })
export class CertificatesApi {
  private readonly http = inject(HttpClient);

  list(filters: CertificateFilters): Observable<Paginated<CertificateListItem>> {
    let params = new HttpParams().set('page', String(filters.page));
    if (filters.search) { params = params.set('search', filters.search); }
    if (filters.status) { params = params.set('status', filters.status); }
    if (filters.supplierId !== null) { params = params.set('supplier_id', String(filters.supplierId)); }
    if (filters.expiring) { params = params.set('expiring', '1'); }
    return this.http.get<Paginated<CertificateListItem>>('/api/v1/certificates', { params });
  }

  get(id: number): Observable<CertificateDetail> {
    return this.http.get<ApiItem<CertificateDetail>>(`/api/v1/certificates/${id}`).pipe(map((r) => r.data));
  }

  /** Multipart upload with progress events; the last event carries the saved certificate. */
  create(fields: CertificateFields, file: File): Observable<UploadEvent> {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (key === 'ingredient_ids') {
        (value as readonly number[]).forEach((id) => form.append('ingredient_ids[]', String(id)));
      } else if (value !== null && value !== undefined && value !== '') {
        form.append(key, String(value));
      }
    }
    form.append('file', file, file.name);

    return this.http.post<ApiItem<CertificateDetail>>('/api/v1/certificates', form, { reportProgress: true, observe: 'events' }).pipe(
      filter((event) => event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response),
      map((event): UploadEvent => event.type === HttpEventType.UploadProgress
        ? { kind: 'progress', percent: event.total ? Math.round((event.loaded / event.total) * 100) : 0 }
        : { kind: 'done', certificate: (event.body as ApiItem<CertificateDetail>).data }),
    );
  }

  update(id: number, fields: Partial<CertificateFields>): Observable<CertificateDetail> {
    return this.http.patch<ApiItem<CertificateDetail>>(`/api/v1/certificates/${id}`, fields).pipe(map((r) => r.data));
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`/api/v1/certificates/${id}`);
  }

  approve(id: number): Observable<CertificateDetail> {
    return this.http.post<ApiItem<CertificateDetail>>(`/api/v1/certificates/${id}/approve`, {}).pipe(map((r) => r.data));
  }

  reject(id: number, reason: string): Observable<CertificateDetail> {
    return this.http.post<ApiItem<CertificateDetail>>(`/api/v1/certificates/${id}/reject`, { reason }).pipe(map((r) => r.data));
  }

  downloadLink(id: number): Observable<DownloadLink> {
    return this.http.post<DownloadLink>(`/api/v1/certificates/${id}/download-link`, {});
  }
}
