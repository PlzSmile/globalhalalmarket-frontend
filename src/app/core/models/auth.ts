/** Mirrors App\Enums\UserRole. */
export type UserRole = 'owner' | 'admin' | 'member';
export type AssignableRole = Exclude<UserRole, 'owner'>;

export interface CompanySummary { readonly id: number; readonly name: string; }
/** Phase 6b: reminder settings (GET/PATCH /api/v1/company…). */
export interface CompanyReminders {
  readonly certificates: boolean;
  readonly recognitions: boolean;
  readonly auto_chase_suppliers: boolean;
  /** 14 Nov 2026: days before a certificate expires when the company is emailed (1 to 5, 0 to 180). */
  readonly certificate_days: readonly number[];
  /** Days before expiry when the supplier is asked for the renewed certificate. */
  readonly chase_days: number;
}
/** Phase 6c: plan and free access. free_until is the day free access ends (null with free = until an admin ends it). */
export type PlanKey = 'starter' | 'pro' | 'consultant';
/** Phase 6c free access + Phase 7a access state (plan = the plan whose limits apply today). */
export interface CompanyAccess {
  readonly state: 'subscribed' | 'free' | 'trial' | 'read_only';
  readonly plan: PlanKey;
  readonly plan_label: string;
  readonly ends_on: string | null;
  readonly can_write: boolean;
  readonly past_due: boolean;
  readonly free: boolean;
  readonly free_until: string | null;
}
/** 12 Nov 2026: what suppliers see instead of us (emails, upload page, audit pack). */
export interface CompanyBranding {
  readonly logo_url: string | null;
  readonly contact_email: string | null;
  /** Security review: suppliers' replies go to contact_email only once a code sent to it was confirmed. */
  readonly phone: string | null;
  readonly website: string | null;
  readonly address: string | null;
}
export interface BrandingChange { name?: string; contact_email?: string | null; phone?: string | null; website?: string | null; address?: string | null; }
export interface CompanyDetail extends CompanySummary {
  readonly reminders?: CompanyReminders;
  readonly access?: CompanyAccess;
  readonly branding?: CompanyBranding;
  readonly needs_setup?: boolean;
}

export interface CurrentUser {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  readonly email_verified: boolean;
  /** 12 Nov 2026: the owner of a new sign-up goes through the setup wizard before the dashboard. */
  readonly setup_required?: boolean;
  readonly two_factor_enabled?: boolean;
  readonly company: CompanySummary;
  /** Phase 7c: a consultant can switch between their own company and its clients. */
  readonly can_switch_companies?: boolean;
  readonly viewing_client?: boolean;
}

export interface SwitchableCompany { readonly id: number; readonly name: string; readonly is_client: boolean; readonly current: boolean; }
export interface SwitchableCompanies { readonly data: readonly SwitchableCompany[]; readonly meta: { readonly can_manage: boolean; readonly max_clients: number }; }

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
/** 3 Nov 2026: the password is right; now a code from the authenticator app or one we emailed. */
export type LoginCodeMethod = 'app' | 'email' | 'recovery';
export interface LoginChallenge { readonly two_factor: true; readonly method: 'app' | 'email'; readonly email_hint: string; readonly resend_after: number; }
export interface EmailCodeSent { readonly email_hint: string; readonly resend_after: number; }
export interface TwoFactorStatus { readonly app: boolean; readonly recovery_codes_left: number; }
export interface TwoFactorSetup { readonly qr: string; readonly secret: string; }
export interface RegisterRequest { name: string; email: string; password: string; password_confirmation: string; company_name: string; offer_code?: string; }
export interface ResetPasswordRequest { token: string; email: string; password: string; password_confirmation: string; }
export interface AcceptInvitationRequest { name: string; password: string; password_confirmation: string; }
export interface PasswordChangeRequest { current_password: string; password: string; password_confirmation: string; }

/** Laravel API Resources wrap single items in { data }. */
export interface ApiItem<T> { readonly data: T; }

export const ROLE_LABELS: Record<UserRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' };
