import type { CertificateListItem } from './certificates';

/** Mirrors the catalogue API (App\Http\Resources\Product*, Supplier*, Ingredient*). */
export interface Paginated<T> {
  readonly data: readonly T[];
  readonly meta: { readonly current_page: number; readonly last_page: number; readonly per_page: number; readonly total: number };
}

export interface NamedRef { readonly id: number; readonly name: string; }
export type LinkTarget = { readonly id: number } | { readonly name: string };

export interface ProductListItem { readonly id: number; readonly name: string; readonly sku: string | null; readonly ingredients_count: number; }
/** Latest-expiring approved certificate of an ingredient (information only until Phase 6). */
export interface IngredientCertificate { readonly id: number; readonly status: 'approved' | 'pending' | 'rejected'; readonly expires_on: string; }
export interface ProductIngredient {
  readonly id: number; readonly name: string; readonly products_count: number; readonly suppliers: readonly NamedRef[];
  readonly certificate?: IngredientCertificate | null;
}
export interface ProductDetail { readonly id: number; readonly name: string; readonly sku: string | null; readonly ingredients: readonly ProductIngredient[]; }
export interface ProductInput { readonly name: string; readonly sku: string | null; }

export interface IngredientOption { readonly id: number; readonly name: string; readonly products_count: number; }
export interface IngredientSuppliers { readonly id: number; readonly name: string; readonly suppliers: readonly NamedRef[]; }
export interface DeleteIngredientResult { readonly unlinked_products: number; readonly unlinked_suppliers: number; }

export interface Country { readonly code: string; readonly name: string; }
export interface SupplierListItem { readonly id: number; readonly name: string; readonly country: Country | null; readonly ingredients_count: number; }
export interface SupplierDetail {
  readonly id: number; readonly name: string; readonly contact_email: string | null;
  readonly country: Country | null; readonly ingredients: readonly NamedRef[];
  readonly certificates?: readonly CertificateListItem[];
}
export interface SupplierInput { readonly name: string; readonly contact_email: string | null; readonly country_code: string | null; }
