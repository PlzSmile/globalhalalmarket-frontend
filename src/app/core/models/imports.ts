/** Mirrors the catalogue import API (App\Services\Import\ImportPlan::toArray). */
export interface ImportCounts {
  readonly products: { readonly create: number; readonly reuse: number };
  readonly ingredients: { readonly create: number; readonly reuse: number };
  readonly suppliers: { readonly create: number; readonly reuse: number; readonly fill: number };
  readonly links: { readonly add: number; readonly existing: number };
}

export interface ImportIssue { readonly row: number; readonly column?: string | null; readonly message: string; }

export interface ImportPreview {
  readonly fingerprint: string;
  readonly counts: ImportCounts;
  readonly warnings: readonly ImportIssue[];
  readonly errors: readonly ImportIssue[];
  readonly errors_total: number;
  readonly can_import: boolean;
}

export interface ImportResult { readonly counts: ImportCounts; }
