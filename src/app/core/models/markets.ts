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
