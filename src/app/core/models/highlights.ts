/** Public list facts for the login page's side panel (GET /api/v1/highlights). */
export type ChangeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface MarketCount { readonly name: string; readonly recognised: number; }

export interface ListChange {
  readonly body: string;
  readonly country: string | null;
  readonly market: string;
  readonly label: string;
  readonly tone: ChangeTone;
  readonly date: string;
  readonly url: string;
}

export interface Highlights {
  readonly bodies: number;
  readonly markets: readonly MarketCount[];
  readonly changes: readonly ListChange[];
}
