import { NamedRef } from './catalogue';

/** Mirrors App\Http\Resources\UploadRequestResource. */
export type UploadRequestStatus = 'open' | 'closed' | 'expired';
export type UploadClosedReason = 'finished' | 'covered' | 'limit' | 'cancelled' | 'replaced';

export type UploadEmailStatus = 'sent' | 'failed' | 'not_sent';

export interface UploadRequestEmail {
  readonly status: UploadEmailStatus;
  readonly to: string | null;
  readonly at: string | null;
}

export interface UploadRequestItem {
  readonly id: number;
  readonly status: UploadRequestStatus;
  readonly closed_reason: UploadClosedReason | null;
  readonly ingredients: readonly NamedRef[];
  readonly note: string | null;
  readonly expires_at: string;
  readonly emailed_to_saved_address: boolean;
  /** Where and when the email went, or that it failed (4 Nov 2026). */
  readonly email: UploadRequestEmail;
  readonly uploads_count: number;
  readonly max_uploads: number;
  readonly created_at: string | null;
  readonly requested_by: NamedRef | null;
}

/** Only the response to sending contains the link (it is never shown again). */
export interface SentUploadRequest extends UploadRequestItem { readonly link: string; }

export interface SendUploadRequestInput {
  readonly ingredient_ids: readonly number[];
  readonly note: string | null;
  readonly send_email: boolean;
}

export const CLOSED_REASON_TEXT: Record<UploadClosedReason, string> = {
  finished: 'Finished by supplier',
  covered: 'All ingredients covered',
  limit: '5 certificates reached',
  cancelled: 'Cancelled',
  replaced: 'Replaced by a newer link',
};
