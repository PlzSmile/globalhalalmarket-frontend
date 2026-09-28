import { AuthorityCode } from './markets';

/** Mirrors GET /api/v1/dashboard (App\Http\Resources\DashboardResource). */
export type OnboardingStepKey = 'markets' | 'team' | 'products' | 'suppliers' | 'certificates';
export type StepStatus = 'done' | 'todo' | 'coming_soon';

export interface OnboardingStep {
  readonly key: OnboardingStepKey;
  readonly status: StepStatus;
}

export interface DashboardMarket {
  readonly code: AuthorityCode;
  readonly market: string;
  readonly authority: string;
  readonly country_code: string;
}

export interface DashboardData {
  readonly markets: readonly DashboardMarket[];
  readonly onboarding: { readonly steps: readonly OnboardingStep[] };
  readonly product_count: number;
}
