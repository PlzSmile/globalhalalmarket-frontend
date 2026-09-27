import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap } from 'rxjs';
import {
  AcceptInvitationRequest, ApiItem, AssignableRole, CurrentUser, InvitationPreview, PendingInvitation, Team, TeamMember,
} from '../models/auth';

@Injectable({ providedIn: 'root' })
export class TeamApi {
  private readonly http = inject(HttpClient);

  team(): Observable<Team> {
    return this.http.get<ApiItem<Team>>('/api/v1/team').pipe(map((r) => r.data));
  }

  invite(email: string, role: AssignableRole): Observable<PendingInvitation> {
    return this.http.post<ApiItem<PendingInvitation>>('/api/v1/team/invitations', { email, role }).pipe(map((r) => r.data));
  }

  resendInvitation(id: number): Observable<PendingInvitation> {
    return this.http.post<ApiItem<PendingInvitation>>(`/api/v1/team/invitations/${id}/resend`, {}).pipe(map((r) => r.data));
  }

  cancelInvitation(id: number): Observable<void> {
    return this.http.delete<void>(`/api/v1/team/invitations/${id}`);
  }

  updateRole(userId: number, role: AssignableRole): Observable<TeamMember> {
    return this.http.patch<ApiItem<TeamMember>>(`/api/v1/team/users/${userId}`, { role }).pipe(map((r) => r.data));
  }

  remove(userId: number): Observable<void> {
    return this.http.delete<void>(`/api/v1/team/users/${userId}`);
  }

  previewInvitation(token: string): Observable<InvitationPreview> {
    return this.http.get<ApiItem<InvitationPreview>>(`/api/v1/invitations/${encodeURIComponent(token)}`).pipe(map((r) => r.data));
  }

  acceptInvitation(token: string, body: AcceptInvitationRequest): Observable<CurrentUser> {
    return this.http.get<void>('/sanctum/csrf-cookie').pipe(
      switchMap(() => this.http.post<ApiItem<CurrentUser>>(`/api/v1/invitations/${encodeURIComponent(token)}/accept`, body)),
      map((r) => r.data),
    );
  }
}
