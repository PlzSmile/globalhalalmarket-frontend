import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiItem } from '../models/auth';
import { SendUploadRequestInput, SentUploadRequest, UploadRequestItem } from '../models/upload-requests';

@Injectable({ providedIn: 'root' })
export class UploadRequestsApi {
  private readonly http = inject(HttpClient);

  list(supplierId: number): Observable<readonly UploadRequestItem[]> {
    return this.http.get<ApiItem<readonly UploadRequestItem[]>>(`/api/v1/suppliers/${supplierId}/upload-requests`).pipe(map((r) => r.data));
  }

  send(supplierId: number, input: SendUploadRequestInput): Observable<SentUploadRequest> {
    return this.http.post<ApiItem<SentUploadRequest>>(`/api/v1/suppliers/${supplierId}/upload-requests`, input).pipe(map((r) => r.data));
  }

  cancel(id: number): Observable<void> {
    return this.http.delete<void>(`/api/v1/upload-requests/${id}`);
  }
}
