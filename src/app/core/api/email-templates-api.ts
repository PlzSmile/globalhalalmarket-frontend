import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiItem } from '../models/auth';
import { EmailPreview, EmailPreviewInput, EmailTemplate, EmailTemplateKind } from '../models/email-templates';

@Injectable({ providedIn: 'root' })
export class EmailTemplatesApi {
  private readonly http = inject(HttpClient);

  list(): Observable<readonly EmailTemplate[]> {
    return this.http.get<ApiItem<readonly EmailTemplate[]>>('/api/v1/email-templates').pipe(map((r) => r.data));
  }

  save(kind: EmailTemplateKind, subject: string, message: string): Observable<EmailTemplate> {
    return this.http.put<ApiItem<EmailTemplate>>(`/api/v1/email-templates/${kind}`, { subject, message }).pipe(map((r) => r.data));
  }

  /** Back to our default wording. */
  reset(kind: EmailTemplateKind): Observable<EmailTemplate> {
    return this.http.delete<ApiItem<EmailTemplate>>(`/api/v1/email-templates/${kind}`).pipe(map((r) => r.data));
  }

  preview(input: EmailPreviewInput): Observable<EmailPreview> {
    return this.http.post<ApiItem<EmailPreview>>('/api/v1/email-templates/preview', input).pipe(map((r) => r.data));
  }
}
