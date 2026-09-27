/** Mirrors App\Enums\UserRole. */
export type UserRole = 'owner' | 'admin' | 'member';
export type AssignableRole = Exclude<UserRole, 'owner'>;

export interface CompanySummary { readonly id: number; readonly name: string; }

export interface CurrentUser {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  readonly email_verified: boolean;
  readonly company: CompanySummary;
}

export interface TeamMember {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  readonly email_verified: boolean;
  readonly is_you: boolean;
}

export interface PendingInvitation {
  readonly id: number;
  readonly email: string;
  readonly role: AssignableRole;
  readonly expires_at: string;
  readonly invited_by: string | null;
}

export interface Team { readonly members: readonly TeamMember[]; readonly invitations: readonly PendingInvitation[]; }

export interface InvitationPreview { readonly company_name: string; readonly email: string; readonly role: AssignableRole; }

export interface LoginRequest { email: string; password: string; remember: boolean; }
export interface RegisterRequest { name: string; email: string; password: string; password_confirmation: string; company_name: string; }
export interface ResetPasswordRequest { token: string; email: string; password: string; password_confirmation: string; }
export interface AcceptInvitationRequest { name: string; password: string; password_confirmation: string; }
export interface PasswordChangeRequest { current_password: string; password: string; password_confirmation: string; }

/** Laravel API Resources wrap single items in { data }. */
export interface ApiItem<T> { readonly data: T; }

export const ROLE_LABELS: Record<UserRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' };
