import { allowedContribution, excessPenalty } from "./tfsa";

export interface Plan {
  /** Lump sum invested at the start. */
  readonly initialCents: number;
  /** Contribution at the start of every month in year 1. */
  readonly monthlyCents: number;
  readonly years: number;
  /** Expected nominal return per year, before fees (e.g. 10 for 10%). */
  readonly annualReturnPct: number;
  /** Contributions increase by this much each year, e.g. with salary increases. */
  readonly annualEscalationPct: number;
  /** Total annual fees (TER plus advice), deducted from the balance. */
  readonly annualFeePct: number;
  /** Used to express results in today's money. */
  readonly inflationPct: number;
  /** Cap contributions at the TFSA annual and lifetime limits. */
  readonly taxFree: boolean;
}

export interface YearRow {
  readonly year: number;
  readonly contributedCents: number;
  readonly totalContributedCents: number;
  readonly growthCents: number;
  readonly feesCents: number;
  readonly endBalanceCents: number;
  /** End balance in today's money (deflated by inflation). */
  readonly realEndBalanceCents: number;
  /** Contributions held back this year to stay within TFSA limits. */
  readonly heldBackCents: number;
}

export interface Projection {
  readonly rows: readonly YearRow[];
  readonly finalCents: number;
  readonly realFinalCents: number;
  readonly totalContributedCents: number;
  readonly totalGrowthCents: number;
  readonly totalFeesCents: number;
  readonly totalHeldBackCents: number;
  /** Tax that would have been due if the held-back amounts had been contributed anyway. */
  readonly penaltyAvoidedCents: number;
}

export const LIMITS = {
  years: { min: 1, max: 60 },
  annualReturnPct: { min: -20, max: 30 },
  annualEscalationPct: { min: 0, max: 20 },
  annualFeePct: { min: 0, max: 5 },
  inflationPct: { min: 0, max: 20 },
  maxAmountCents: 100_000_000_00, // R100 million per input
} as const;

export class PlanError extends Error {
  constructor(
    readonly field: keyof Plan,
    message: string,
  ) {
    super(message);
    this.name = "PlanError";
  }
}

export function validatePlan(plan: Plan): void {
  const intIn = (field: keyof Plan, value: number, min: number, max: number) => {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new PlanError(field, `${field} must be a whole number from ${min} to ${max}`);
    }
  };
  const numIn = (field: keyof Plan, value: number, min: number, max: number) => {
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new PlanError(field, `${field} must be between ${min} and ${max}`);
    }
  };
  intIn("initialCents", plan.initialCents, 0, LIMITS.maxAmountCents);
  intIn("monthlyCents", plan.monthlyCents, 0, LIMITS.maxAmountCents);
  intIn("years", plan.years, LIMITS.years.min, LIMITS.years.max);
  numIn("annualReturnPct", plan.annualReturnPct, LIMITS.annualReturnPct.min, LIMITS.annualReturnPct.max);
  numIn("annualEscalationPct", plan.annualEscalationPct, LIMITS.annualEscalationPct.min, LIMITS.annualEscalationPct.max);
  numIn("annualFeePct", plan.annualFeePct, LIMITS.annualFeePct.min, LIMITS.annualFeePct.max);
  numIn("inflationPct", plan.inflationPct, LIMITS.inflationPct.min, LIMITS.inflationPct.max);
}

/** Converts an annual rate to the equivalent monthly rate: (1 + r)^(1/12) − 1, not r / 12. */
export function monthlyRate(annualPct: number): number {
  return (1 + annualPct / 100) ** (1 / 12) - 1;
}

/**
 * Month-by-month projection. Each month: contribute at the start (capped
 * for a TFSA), grow at the monthly-equivalent return, then deduct the
 * monthly-equivalent fee. Every amount is rounded to whole cents each month,
 * like a real statement, so totals reconcile exactly:
 *   final = initial + contributions + growth − fees.
 * Each plan year is treated as one tax year for the TFSA limits.
 */
export function project(plan: Plan): Projection {
  validatePlan(plan);
  const growthRate = monthlyRate(plan.annualReturnPct);
  const feeRate = 1 - (1 - plan.annualFeePct / 100) ** (1 / 12);
  const rows: YearRow[] = [];

  let balance = 0;
  let lifetime = 0;
  let totalContributed = 0;
  let totalGrowth = 0;
  let totalFees = 0;
  let totalHeldBack = 0;
  let monthly = plan.monthlyCents;

  for (let year = 1; year <= plan.years; year++) {
    let contributed = 0;
    let growth = 0;
    let fees = 0;
    let heldBack = 0;

    for (let month = 1; month <= 12; month++) {
      const proposed = (year === 1 && month === 1 ? plan.initialCents : 0) + monthly;
      const actual = plan.taxFree
        ? allowedContribution(proposed, { contributedThisYearCents: contributed, contributedLifetimeCents: lifetime })
        : proposed;
      heldBack += proposed - actual;
      contributed += actual;
      lifetime += actual;
      balance += actual;

      const g = Math.round(balance * growthRate);
      balance += g;
      growth += g;
      const f = Math.round(balance * feeRate);
      balance -= f;
      fees += f;
    }
    if (!Number.isSafeInteger(balance)) {
      // Past 2^53 cents (about R90 trillion) integer maths stops being exact; refuse rather than show wrong numbers.
      throw new PlanError("years", "These inputs grow too large to calculate exactly; shorten the term or lower the return");
    }

    totalContributed += contributed;
    totalGrowth += growth;
    totalFees += fees;
    totalHeldBack += heldBack;
    rows.push({
      year,
      contributedCents: contributed,
      totalContributedCents: totalContributed,
      growthCents: growth,
      feesCents: fees,
      endBalanceCents: balance,
      realEndBalanceCents: Math.round(balance / (1 + plan.inflationPct / 100) ** year),
      heldBackCents: heldBack,
    });
    monthly = Math.round(monthly * (1 + plan.annualEscalationPct / 100));
  }

  const last = rows.at(-1)!;
  return {
    rows,
    finalCents: last.endBalanceCents,
    realFinalCents: last.realEndBalanceCents,
    totalContributedCents: totalContributed,
    totalGrowthCents: totalGrowth,
    totalFeesCents: totalFees,
    totalHeldBackCents: totalHeldBack,
    penaltyAvoidedCents: excessPenalty(totalHeldBack),
  };
}

export type GoalResult =
  | { readonly kind: "already_met" }
  | { readonly kind: "monthly"; readonly monthlyCents: number }
  | { readonly kind: "unreachable"; readonly reason: string };

/**
 * Smallest starting monthly contribution (to the cent) that reaches the
 * target. Without TFSA caps the final balance never decreases as the
 * contribution grows (every month multiplies by a positive factor), so binary
 * search is exact. With caps and fees above returns, timing effects can make
 * the answer a few cents from the true minimum; it still always reaches the target.
 */
export function solveMonthly(plan: Plan, targetCents: number, inTodaysMoney: boolean): GoalResult {
  const final = (monthlyCents: number) => {
    try {
      const p = project({ ...plan, monthlyCents });
      return inTodaysMoney ? p.realFinalCents : p.finalCents;
    } catch (err) {
      // Too large to compute exactly means comfortably above any target we accept.
      if (err instanceof PlanError) return Number.POSITIVE_INFINITY;
      throw err;
    }
  };
  if (final(0) >= targetCents) return { kind: "already_met" };
  let hi = Math.max(100, plan.monthlyCents);
  while (final(hi) < targetCents) {
    if (hi >= LIMITS.maxAmountCents) {
      return {
        kind: "unreachable",
        reason: plan.taxFree
          ? "TFSA limits cap what you can contribute; this target needs more than the limits allow."
          : "This target needs an unrealistically large monthly contribution.",
      };
    }
    hi = Math.min(LIMITS.maxAmountCents, hi * 2);
  }
  let lo = 0;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (final(mid) >= targetCents) hi = mid;
    else lo = mid;
  }
  return { kind: "monthly", monthlyCents: hi };
}
