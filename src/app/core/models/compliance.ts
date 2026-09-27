/** Mirrors the backend compliance engine output (App\Services\Compliance). */
export type ComplianceStatus = 'green' | 'amber' | 'red';

export interface Market {
  readonly slug: string;
  readonly name: string;
  readonly authority: string;
  readonly flag: string;
}

export interface ComplianceCell {
  readonly market: string;
  readonly status: ComplianceStatus;
  readonly reason: string | null;
}

export interface ProductCompliance {
  readonly id: number;
  readonly name: string;
  readonly sku: string;
  readonly cells: readonly ComplianceCell[];
}
