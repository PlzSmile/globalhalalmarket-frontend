import { AuthorityCode } from './markets';

/** 16 Nov 2026: "Share with a buyer", a read-only link to one product's compliance for one market (30 days). */
export interface ShareLinkItem {
  readonly id: number;
  readonly market: AuthorityCode;
  readonly expires_at: string;
  readonly created_at: string;
  readonly created_by: string | null;
  readonly views_count: number;
  readonly last_viewed_at: string | null;
}

/** Only the create answer carries the link (and "Copy link" fetches it again). */
export interface CreatedShareLink extends ShareLinkItem {
  readonly url: string;
}
