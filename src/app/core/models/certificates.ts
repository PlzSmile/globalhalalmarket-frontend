import { Country, NamedRef } from './catalogue';

/** Mirrors the certificates API (App\Http\Resources\Certificate*). */
export type CertificateStatus = 'approved' | 'pending' | 'rejected';

/** 16 Nov 2026 (week 8): what a certificate certifies. Only halal counts for recognition and red/amber/green. */
export type CertificateType = 'halal' | 'brcgs' | 'iso22000' | 'fssc22000' | 'ifs_food' | 'salsa' | 'organic' | 'vegan' | 'kosher' | 'other';

/** The type list in the order the forms show it (labels as the API's type_label). */
export const CERTIFICATE_TYPES: readonly { readonly value: CertificateType; readonly label: string }[] = [
  { value: 'halal', label: 'Halal' },
  { value: 'brcgs', label: 'BRCGS Food Safety' },
  { value: 'iso22000', label: 'ISO 22000' },
  { value: 'fssc22000', label: 'FSSC 22000' },
  { value: 'ifs_food', label: 'IFS Food' },
  { value: 'salsa', label: 'SALSA' },
  { value: 'organic', label: 'Organic' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'other', label: 'Other' },
];

export interface BodyOption { readonly id: number; readonly name: string; readonly country: Country | null; }

export interface CertificateListItem {
  readonly id: number;
  readonly status: CertificateStatus;
  /** Week 8; older API answers have none (treat as halal). */
  readonly type?: CertificateType;
  readonly type_name?: string | null;
  readonly type_label?: string;
  readonly body: NamedRef | null;
  readonly body_name_other: string | null;
  readonly supplier: NamedRef;
  readonly certificate_number: string | null;
  readonly issued_on: string | null;
  readonly expires_on: string;
  readonly ingredients_count: number;
  /** Archived (Phase 6a): kept with its PDF, hidden by default, read-only until restored. */
  readonly archived_at?: string | null;
}

/** pending: AWS is still checking the file (usually under a minute); infected: deleted; failed: no result, blocked. */
export type FileScan = 'clean' | 'pending' | 'infected' | 'failed';

export interface CertificateDetail extends CertificateListItem {
  readonly scope: string | null;
  readonly ingredients: readonly NamedRef[];
  /** scan: the file's virus check (30 Oct 2026); only a clean file can be downloaded. */
  readonly file: { readonly original_name: string; readonly size: number; readonly scan?: FileScan };
  readonly reviewed_by: NamedRef | null;
  readonly reviewed_at: string | null;
  readonly rejection_reason: string | null;
  readonly created_at: string | null;
  /** Uploaded by the supplier through an upload link (Phase 5b). */
  readonly from_upload_link: boolean;
}

export interface CertificateFields {
  readonly supplier_id: number;
  readonly type: CertificateType;
  readonly type_name: string | null;
  readonly certification_body_id: number | null;
  readonly body_name_other: string | null;
  readonly certificate_number: string | null;
  readonly scope: string | null;
  readonly issued_on: string | null;
  readonly expires_on: string;
  readonly ingredient_ids: readonly number[];
}

export interface CertificateFilters {
  readonly search: string;
  readonly status: CertificateStatus | null;
  readonly type?: CertificateType | null;
  readonly supplierId: number | null;
  readonly expiring: boolean;
  readonly archived: boolean;
  readonly page: number;
}

export interface DownloadLink { readonly url: string; readonly expires_at: string; }

export type UploadEvent = { readonly kind: 'progress'; readonly percent: number } | { readonly kind: 'done'; readonly certificate: CertificateDetail };

/** Body name as shown to users: catalogue body or the typed name. */
export function bodyName(certificate: { readonly body: NamedRef | null; readonly body_name_other: string | null }): string {
  return certificate.body?.name ?? certificate.body_name_other ?? '';
}

/** 16 Nov 2026 (week 4): values suggested from a certificate PDF (text PDFs only); a person checks them before saving. */
export interface CertificateReading {
  readonly read: boolean;
  readonly certification_body_id: number | null;
  readonly body_name: string | null;
  readonly certificate_number: string | null;
  readonly issued_on: string | null;
  readonly expires_on: string | null;
}
