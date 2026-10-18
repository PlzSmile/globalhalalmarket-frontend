import { PlanKey } from './auth';

/** Phase 7a: what the company can do right now (decided by the server). */
export type AccessState = 'subscribed' | 'free' | 'trial' | 'read_only';
export type BillingInterval = 'monthly' | 'yearly';

export interface PlanLimits { readonly suppliers: number | null; readonly markets: number; readonly users: number; }
export interface PlanUsage { readonly suppliers: number; readonly markets: number; readonly users: number; }

export interface OfferedPlan {
  readonly plan: PlanKey;
  readonly name: string;
  readonly description: string | null;
  readonly limits: PlanLimits;
  /** Cents (USD, excluding tax); null when not offered. */
  readonly monthly: number | null;
  readonly yearly: number | null;
  /** Published to Paddle, so the checkout can open. */
  readonly can_buy_monthly: boolean;
  readonly can_buy_yearly: boolean;
}

export interface NextPayment { readonly date: string; readonly amount: string; readonly currency: string; }

export interface Billing {
  readonly state: AccessState;
  readonly plan: PlanKey;
  readonly plan_label: string;
  readonly interval: BillingInterval | null;
  readonly ends_on: string | null;
  readonly next_payment: NextPayment | null;
  readonly cancelled: boolean;
  readonly past_due: boolean;
  readonly can_manage: boolean;
  readonly usage: PlanUsage;
  readonly limits: PlanLimits;
  readonly plans: readonly OfferedPlan[];
}

export interface Invoice { readonly id: string; readonly date: string; readonly total: number; readonly currency: string; readonly status: string; }

/** Body of a 422 when adding something would pass the plan limit. */
export interface PlanLimitError { readonly code: 'plan_limit'; readonly limit: keyof PlanLimits; readonly allowed: number; readonly message: string; }
