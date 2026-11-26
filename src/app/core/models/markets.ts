/** Mirrors GET/PUT /api/v1/markets (App\Http\Resources\MarketOptionResource). */
export type AuthorityCode = 'BPJPH' | 'JAKIM' | 'MOIAT' | 'GAC' | 'CICOT' | 'MOPH' | 'SFDA';

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
export const MARKET_LABELS: Record<AuthorityCode, string> = {
  BPJPH: 'Indonesia · BPJPH', JAKIM: 'Malaysia · JAKIM', MOIAT: 'UAE · MoIAT',
  GAC: 'Gulf · GAC', CICOT: 'Thailand · CICOT', MOPH: 'Qatar · MoPH', SFDA: 'Saudi Arabia · SFDA', // 22 Nov 2026: were shown as bare codes
};

export function marketLabel(code: AuthorityCode | string | null | undefined): string {
  return code ? (MARKET_LABELS[code as AuthorityCode] ?? code) : '';
}
