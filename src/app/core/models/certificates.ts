import { Country, NamedRef } from './catalogue';

/** Mirrors the certificates API (App\Http\Resources\Certificate*). */
export type CertificateStatus = 'approved' | 'pending' | 'rejected';

export interface BodyOption { readonly id: number; readonly name: string; readonly country: Country | null; }

export interface CertificateListItem {
  readonly id: number;
  readonly status: CertificateStatus;
  readonly body: NamedRef | null;
  readonly body_name_other: string | null;
  readonly supplier: NamedRef;
  readonly certificate_number: string | null;
  readonly issued_on: string | null;
  readonly expires_on: string;
  readonly ingredients_count: number;
}

export interface CertificateDetail extends CertificateListItem {
  readonly scope: string | null;
  readonly ingredients: readonly NamedRef[];
  readonly file: { readonly original_name: string; readonly size: number };
  readonly reviewed_by: NamedRef | null;
  readonly reviewed_at: string | null;
  readonly rejection_reason: string | null;
  readonly created_at: string | null;
}

export interface CertificateFields {
  readonly supplier_id: number;
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
  readonly supplierId: number | null;
  readonly expiring: boolean;
  readonly page: number;
}

export interface DownloadLink { readonly url: string; readonly expires_at: string; }

export type UploadEvent = { readonly kind: 'progress'; readonly percent: number } | { readonly kind: 'done'; readonly certificate: CertificateDetail };

/** Body name as shown to users: catalogue body or the typed name. */
export function bodyName(certificate: { readonly body: NamedRef | null; readonly body_name_other: string | null }): string {
  return certificate.body?.name ?? certificate.body_name_other ?? '';
}
