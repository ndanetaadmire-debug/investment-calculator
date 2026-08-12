import { LIMITS, type Plan } from "./projection";

export const DEFAULT_PLAN: Plan = {
  initialCents: 10_000_00,
  monthlyCents: 2_000_00,
  years: 20,
  annualReturnPct: 10,
  annualEscalationPct: 5,
  annualFeePct: 1,
  inflationPct: 5,
  taxFree: false,
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Scenario <-> query string, so a plan can be bookmarked or shared.
 * Anything missing, malformed or out of range falls back to a safe value;
 * a hand-edited URL can never put the calculator into an invalid state.
 */
export function planToQuery(plan: Plan): string {
  const params = new URLSearchParams({
    initial: String(plan.initialCents / 100),
    monthly: String(plan.monthlyCents / 100),
    years: String(plan.years),
    return: String(plan.annualReturnPct),
    escalation: String(plan.annualEscalationPct),
    fees: String(plan.annualFeePct),
    inflation: String(plan.inflationPct),
  });
  if (plan.taxFree) params.set("tfsa", "1");
  return params.toString();
}

export function planFromQuery(query: string): Plan {
  const params = new URLSearchParams(query);
  const num = (key: string, fallback: number, min: number, max: number, integer = false) => {
    const raw = params.get(key);
    if (raw === null || raw.trim() === "") return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return clamp(integer ? Math.round(n) : n, min, max);
  };
  const rands = (key: string, fallbackCents: number) =>
    Math.round(num(key, fallbackCents / 100, 0, LIMITS.maxAmountCents / 100) * 100);
  return {
    initialCents: rands("initial", DEFAULT_PLAN.initialCents),
    monthlyCents: rands("monthly", DEFAULT_PLAN.monthlyCents),
    years: num("years", DEFAULT_PLAN.years, LIMITS.years.min, LIMITS.years.max, true),
    annualReturnPct: num("return", DEFAULT_PLAN.annualReturnPct, LIMITS.annualReturnPct.min, LIMITS.annualReturnPct.max),
    annualEscalationPct: num("escalation", DEFAULT_PLAN.annualEscalationPct, LIMITS.annualEscalationPct.min, LIMITS.annualEscalationPct.max),
    annualFeePct: num("fees", DEFAULT_PLAN.annualFeePct, LIMITS.annualFeePct.min, LIMITS.annualFeePct.max),
    inflationPct: num("inflation", DEFAULT_PLAN.inflationPct, LIMITS.inflationPct.min, LIMITS.inflationPct.max),
    taxFree: params.get("tfsa") === "1",
  };
}
