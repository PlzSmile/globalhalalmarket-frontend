/** Mirrors GET/PUT /api/v1/markets (App\Http\Resources\MarketOptionResource). */
export type AuthorityCode = 'BPJPH' | 'JAKIM' | 'MOIAT';

export interface MarketOption {
  readonly code: AuthorityCode;
  readonly market: string;
  readonly market_slug: string;
  readonly authority: string;
  readonly country_code: string;
  readonly data_note: string | null;
  readonly selected: boolean;
}

/** 5 Nov 2026 (Bilal): every market is shown with its country, e.g. "Indonesia · BPJPH". */
export const MARKET_LABELS: Record<AuthorityCode, string> = { BPJPH: 'Indonesia · BPJPH', JAKIM: 'Malaysia · JAKIM', MOIAT: 'UAE · MoIAT' };

export function marketLabel(code: AuthorityCode | string | null | undefined): string {
  return code ? (MARKET_LABELS[code as AuthorityCode] ?? code) : '';
}
