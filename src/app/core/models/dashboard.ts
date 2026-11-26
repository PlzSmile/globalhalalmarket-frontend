import { ComplianceSummary } from './compliance';
import { AuthorityCode } from './markets';

/** Mirrors GET /api/v1/dashboard (App\Http\Resources\DashboardResource). */
export type OnboardingStepKey = 'markets' | 'team' | 'products' | 'suppliers' | 'certificates';
export type StepStatus = 'done' | 'todo' | 'coming_soon';

export interface OnboardingStep {
  readonly key: OnboardingStepKey;
  readonly status: StepStatus;
}

export interface DashboardMarket {
  readonly code: AuthorityCode;
  readonly market: string;
  readonly authority: string;
  readonly country_code: string;
}

/** 14 Nov 2026: 12 week ends (oldest first, the last is today); each product counted once, by its worst market. */
export interface DashboardTrends {
  readonly weeks: readonly string[];
  readonly products: readonly number[];
  readonly overall: { readonly green: readonly number[]; readonly amber: readonly number[]; readonly red: readonly number[] };
}

/** Certificates in use, not archived: approved and valid beyond 60 days, expiring within 60 days, expired; waiting for review. */
export interface DashboardCertificates {
  readonly valid: number;
  readonly expiring: number;
  readonly expired: number;
  readonly pending: number;
}

export interface DashboardChange {
  readonly id: number;
  readonly product_id: number;
  readonly product: string;
  readonly market: AuthorityCode | null;
  /** null: no longer tracked (market removed). */
  readonly status: 'green' | 'amber' | 'red' | null;
  readonly reason: string | null;
  readonly changed_at: string;
}

export interface DashboardData {
  readonly markets: readonly DashboardMarket[];
  readonly onboarding: { readonly steps: readonly OnboardingStep[] };
  readonly product_count: number;
  readonly compliance: ComplianceSummary;
  readonly trends: DashboardTrends;
  readonly certificates: DashboardCertificates;
  readonly latest_changes: readonly DashboardChange[];
}
