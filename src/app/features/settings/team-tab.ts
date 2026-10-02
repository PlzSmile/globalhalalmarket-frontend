import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { TeamApi } from '../../core/api/team-api';
import { AuthService } from '../../core/auth/auth.service';
import { AssignableRole, PendingInvitation, ROLE_LABELS, Team, TeamMember, UserRole } from '../../core/models/auth';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/ui/confirm-dialog';
import { InviteDialog } from './invite-dialog';

@Component({
  selector: 'hs-team-tab',
  imports: [DatePipe, MatButtonModule, MatCardModule, MatIconModule, MatProgressBarModule, MatSelectModule, MatTableModule],
  templateUrl: './team-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamTab implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(TeamApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly columns = ['name', 'email', 'role', 'actions'];
  protected readonly team = signal<Team | null>(null);
  protected readonly failed = signal(false);

  ngOnInit(): void {
    void this.load();
  }

  protected roleLabel(role: UserRole): string {
    return ROLE_LABELS[role];
  }

  /** The server enforces the same rules; this only hides actions that would be refused. */
  protected canEdit(member: TeamMember): boolean {
    return this.auth.canManageTeam() && member.role !== 'owner' && !member.is_you;
  }

  async load(): Promise<void> {
    this.failed.set(false);
    try {
      this.team.set(await firstValueFrom(this.api.team()));
    } catch {
      this.failed.set(true);
    }
  }

  async invite(): Promise<void> {
    const sent = await firstValueFrom(this.dialog.open(InviteDialog, { autoFocus: 'first-tabbable' }).afterClosed());
    if (sent) {
      this.snackBar.open(`Invitation sent to ${sent.email}.`, 'Close', { duration: 5000 });
      await this.load();
    }
  }

  async changeRole(member: TeamMember, role: AssignableRole): Promise<void> {
    try {
      await firstValueFrom(this.api.updateRole(member.id, role));
      this.snackBar.open(`${member.name} is now ${ROLE_LABELS[role]}.`, 'Close', { duration: 4000 });
    } finally {
      await this.load();
    }
  }

  async remove(member: TeamMember): Promise<void> {
    if (!(await this.confirm({ title: `Remove ${member.name}?`, message: `${member.email} will lose access to Global Halal Market straight away.`, confirmLabel: 'Remove' }))) return;
    try {
      await firstValueFrom(this.api.remove(member.id));
      this.snackBar.open(`${member.name} was removed.`, 'Close', { duration: 4000 });
    } finally {
      await this.load();
    }
  }

  async resend(invitation: PendingInvitation): Promise<void> {
    try {
      await firstValueFrom(this.api.resendInvitation(invitation.id));
      this.snackBar.open(`A new link was sent to ${invitation.email}.`, 'Close', { duration: 4000 });
    } finally {
      await this.load();
    }
  }

  async cancel(invitation: PendingInvitation): Promise<void> {
    if (!(await this.confirm({ title: 'Cancel invitation?', message: `The link sent to ${invitation.email} will stop working.`, confirmLabel: 'Cancel invitation' }))) return;
    try {
      await firstValueFrom(this.api.cancelInvitation(invitation.id));
    } finally {
      await this.load();
    }
  }

  private async confirm(data: ConfirmDialogData): Promise<boolean> {
    return (await firstValueFrom(this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data }).afterClosed())) === true;
  }
}
