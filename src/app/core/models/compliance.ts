import { AuthorityCode } from './markets';

/** Mirrors the compliance API (App\Services\Compliance, App\Http\Controllers\Api\V1\Compliance*). */
export type ComplianceStatus = 'green' | 'amber' | 'red';

export const STATUS_LABELS: Record<ComplianceStatus, string> = { red: 'Action needed', amber: 'Valid · expires soon', green: 'Compliant' };

export interface ComplianceCell {
  readonly market: AuthorityCode;
  /** null: not calculated yet. */
  readonly status: ComplianceStatus | null;
  readonly reason: string | null;
  readonly reasons_count: number;
  readonly next_expiry_on: string | null;
}

export interface ProductComplianceRow {
  readonly id: number;
  readonly name: string;
  readonly sku: string | null;
  readonly status: ComplianceStatus | null;
  readonly cells: readonly ComplianceCell[];
}

export interface ComplianceFilters {
  readonly market: AuthorityCode | null;
  readonly status: ComplianceStatus | null;
  readonly supplier: number | null;
  readonly search: string;
  readonly page: number;
}

export type ScopeCheckResult = 'covers' | 'not_covered';

export interface ScopeCheck {
  readonly result: ScopeCheckResult;
  readonly note: string | null;
  readonly by: string | null;
  readonly at: string;
}

export interface BreakdownCertificate {
  readonly id: number;
  readonly supplier: string;
  readonly body: string;
  readonly expires_on: string;
  readonly scope: string | null;
  /** null: not published by the authority. */
  readonly authority_scopes: readonly string[] | null;
  readonly scope_check: ScopeCheck | null;
}

export interface BreakdownIngredient {
  readonly id: number;
  readonly name: string;
  readonly status: ComplianceStatus | null;
  readonly reasons: readonly string[];
  readonly certificates: readonly BreakdownCertificate[];
}

export interface MarketBreakdown {
  readonly market: AuthorityCode;
  readonly authority: string;
  readonly status: ComplianceStatus | null;
  readonly next_expiry_on: string | null;
  readonly reasons: readonly string[];
  readonly ingredients: readonly BreakdownIngredient[];
}

export interface HistoryEntry {
  readonly market: AuthorityCode | null;
  /** null: not tracked (before the first calculation, or the market was removed). */
  readonly status: ComplianceStatus | null;
  readonly reasons: readonly string[];
  readonly changed_at: string | null;
}

export interface StatusOnDate {
  readonly on: string;
  readonly markets: readonly HistoryEntry[];
}

export interface StatusCounts {
  readonly green: number;
  readonly amber: number;
  readonly red: number;
}

export type UpcomingExpiry =
  | { readonly kind: 'certificate'; readonly date: string; readonly days_left: number; readonly certificate_id: number; readonly supplier: string; readonly body: string; readonly products: number }
  | { readonly kind: 'recognition'; readonly date: string; readonly days_left: number; readonly body: string; readonly authority: string; readonly products: number };

export interface ComplianceSummary {
  readonly computed_at: string | null;
  readonly summary: { readonly overall: StatusCounts; readonly markets: readonly ({ readonly code: AuthorityCode } & StatusCounts)[] };
  readonly upcoming_expiries: readonly UpcomingExpiry[];
}
