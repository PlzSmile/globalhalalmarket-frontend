/** Mirrors App\Enums\EmailTemplateKind and EmailTemplateController (12 Nov 2026: Xero-style supplier emails). */
export type EmailTemplateKind = 'upload_request' | 'renewal_chase';

export interface EmailTemplate {
  readonly kind: EmailTemplateKind;
  readonly label: string;
  readonly subject: string;
  readonly message: string;
  /** Our default wording (the customer has not saved their own). */
  readonly is_default: boolean;
  /** Placeholder names without brackets, e.g. "Supplier Name". */
  readonly placeholders: readonly string[];
}

export interface EmailPreviewInput {
  readonly kind: EmailTemplateKind;
  readonly subject: string;
  readonly message: string;
  readonly supplier_id?: number | null;
  readonly ingredient_ids?: readonly number[];
  /** 19 Nov 2026: fills [Certificate Type] ("halal", "BRCGS Food Safety"…). */
  readonly certificate_type?: string;
}

export interface EmailPreview {
  readonly subject: string;
  /** The whole email as the supplier gets it; shown in a sandboxed iframe. */
  readonly html: string;
}

/** What the "Send email" dialog sends with the upload request. */
export interface EmailDraftInput {
  readonly to: readonly string[];
  readonly cc: readonly string[];
  readonly bcc: readonly string[];
  readonly subject: string;
  readonly message: string;
}

/** Same limit as SupplierEmails::MAX_RECIPIENTS on the server. */
export const MAX_RECIPIENTS = 5;

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export function isEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}
