import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatRands } from "../src/engine/money";
import { monthlyRate, PlanError, project, solveMonthly, type Plan } from "../src/engine/projection";
import { allowedContribution, excessPenalty, TFSA } from "../src/engine/tfsa";
import { DEFAULT_PLAN, planFromQuery, planToQuery } from "../src/engine/urlState";

const flat: Plan = {
  initialCents: 0,
  monthlyCents: 1_000_00,
  years: 10,
  annualReturnPct: 0,
  annualEscalationPct: 0,
  annualFeePct: 0,
  inflationPct: 0,
  taxFree: false,
};

/** Arbitrary valid plans, kept to ranges where results stay comfortably exact. */
const planArb = fc.record({
  initialCents: fc.integer({ min: 0, max: 5_000_000_00 }),
  monthlyCents: fc.integer({ min: 0, max: 200_000_00 }),
  years: fc.integer({ min: 1, max: 40 }),
  annualReturnPct: fc.double({ min: -10, max: 20, noNaN: true }),
  annualEscalationPct: fc.double({ min: 0, max: 10, noNaN: true }),
  annualFeePct: fc.double({ min: 0, max: 3, noNaN: true }),
  inflationPct: fc.double({ min: 0, max: 10, noNaN: true }),
  taxFree: fc.boolean(),
});

describe("project: worked examples", () => {
  it("is plain addition at 0% return", () => {
    const p = project(flat);
    expect(p.finalCents).toBe(120 * 1_000_00);
    expect(p.totalGrowthCents).toBe(0);
    expect(p.rows).toHaveLength(10);
  });

  it("uses the monthly-equivalent rate, so a lump sum compounds to exactly 10% a year", () => {
    expect(monthlyRate(10)).toBeCloseTo(0.0079741404, 9);
    const p = project({ ...flat, initialCents: 100_000_00, monthlyCents: 0, annualReturnPct: 10, years: 1 });
    expect(Math.abs(p.finalCents - 110_000_00)).toBeLessThanOrEqual(6); // within a few cents of monthly rounding
  });

  it("matches the annuity-due closed form for steady contributions", () => {
    const plan = { ...flat, initialCents: 50_000_00, monthlyCents: 2_000_00, annualReturnPct: 9, years: 25 };
    const i = monthlyRate(9);
    const n = 25 * 12;
    const closed = plan.initialCents * (1 + i) ** n + plan.monthlyCents * (1 + i) * (((1 + i) ** n - 1) / i);
    // Rounding to the cent every month can drift by at most a cent or so per month.
    expect(Math.abs(project(plan).finalCents - closed)).toBeLessThan(n);
  });

  it("shows what a 1% fee costs over 30 years", () => {
    const base = { ...flat, monthlyCents: 3_000_00, annualReturnPct: 10, years: 30 };
    const cheap = project({ ...base, annualFeePct: 0.25 });
    const pricey = project({ ...base, annualFeePct: 1.25 });
    const lost = cheap.finalCents - pricey.finalCents;
    // Roughly a fifth of the final balance: the point the UI makes about fees.
    expect(lost / cheap.finalCents).toBeGreaterThan(0.15);
    expect(lost / cheap.finalCents).toBeLessThan(0.25);
  });

  it("escalates contributions once a year", () => {
    const p = project({ ...flat, annualEscalationPct: 10, years: 3 });
    expect(p.rows.map((r) => r.contributedCents)).toEqual([12_000_00, 13_200_00, 14_520_00]);
  });

  it("deflates by inflation for today's money", () => {
    const p = project({ ...flat, initialCents: 100_000_00, monthlyCents: 0, inflationPct: 5, years: 2 });
    expect(p.realFinalCents).toBe(Math.round(100_000_00 / 1.05 ** 2));
  });
});

describe("project: TFSA limits", () => {
  it("caps contributions at the annual limit and reports the penalty avoided", () => {
    const p = project({ ...flat, monthlyCents: 5_000_00, years: 1, taxFree: true });
    expect(p.rows[0]!.contributedCents).toBe(TFSA.annualLimitCents);
    expect(p.totalHeldBackCents).toBe(60_000_00 - 46_000_00);
    expect(p.penaltyAvoidedCents).toBe(Math.round(14_000_00 * 0.4));
  });

  it("counts a lump sum towards the first year's limit", () => {
    const p = project({ ...flat, initialCents: 40_000_00, monthlyCents: 1_000_00, years: 1, taxFree: true });
    expect(p.rows[0]!.contributedCents).toBe(46_000_00);
  });

  it("stops at the R500 000 lifetime limit while growth continues", () => {
    const p = project({ ...flat, monthlyCents: Math.round(46_000_00 / 12), annualReturnPct: 8, years: 15, taxFree: true });
    expect(p.totalContributedCents).toBeLessThanOrEqual(TFSA.lifetimeLimitCents);
    expect(p.totalContributedCents).toBeGreaterThan(TFSA.lifetimeLimitCents - 46_000_00);
    expect(p.rows.at(-1)!.contributedCents).toBe(0);
    expect(p.finalCents).toBeGreaterThan(TFSA.lifetimeLimitCents);
  });

  it("allowedContribution respects whichever limit is tighter", () => {
    expect(allowedContribution(10_000_00, { contributedThisYearCents: 40_000_00, contributedLifetimeCents: 0 })).toBe(6_000_00);
    expect(allowedContribution(10_000_00, { contributedThisYearCents: 0, contributedLifetimeCents: 497_000_00 })).toBe(3_000_00);
    expect(allowedContribution(10_000_00, { contributedThisYearCents: 46_000_00, contributedLifetimeCents: 0 })).toBe(0);
    expect(excessPenalty(-5)).toBe(0);
  });
});

describe("project: properties", () => {
  it("always reconciles: final = contributions + growth − fees", () => {
    fc.assert(
      fc.property(planArb, (plan) => {
        const p = project(plan);
        expect(p.finalCents).toBe(p.totalContributedCents + p.totalGrowthCents - p.totalFeesCents);
        for (const r of p.rows) expect(Number.isSafeInteger(r.endBalanceCents)).toBe(true);
      }),
    );
  });

  it("never lets a TFSA exceed its limits", () => {
    fc.assert(
      fc.property(planArb, (plan) => {
        const p = project({ ...plan, taxFree: true });
        expect(p.totalContributedCents).toBeLessThanOrEqual(TFSA.lifetimeLimitCents);
        for (const r of p.rows) expect(r.contributedCents).toBeLessThanOrEqual(TFSA.annualLimitCents);
      }),
    );
  });

  // Without TFSA caps, every month's money only grows by a positive factor, so more in means more out.
  // (With caps, contributing more can hit the annual limit sooner; if fees exceed returns, money that
  // arrives earlier loses more to fees. fast-check found that case, and it's real economics, not a bug.)
  it("more saving never ends with less money (uncapped)", () => {
    fc.assert(
      fc.property(planArb.map((p) => ({ ...p, taxFree: false })), fc.integer({ min: 1, max: 10_000_00 }), (plan, extra) => {
        expect(project({ ...plan, monthlyCents: plan.monthlyCents + extra }).finalCents).toBeGreaterThanOrEqual(project(plan).finalCents);
      }),
    );
  });

  it("higher fees never end with more money", () => {
    fc.assert(
      fc.property(planArb, fc.double({ min: 0.01, max: 1, noNaN: true }), (plan, extraFee) => {
        const more = { ...plan, annualFeePct: Math.min(5, plan.annualFeePct + extraFee) };
        expect(project(more).finalCents).toBeLessThanOrEqual(project(plan).finalCents);
      }),
    );
  });

  it("today's money is never more than the nominal balance", () => {
    fc.assert(
      fc.property(planArb, (plan) => {
        expect(project(plan).realFinalCents).toBeLessThanOrEqual(project(plan).finalCents);
      }),
    );
  });
});

describe("validation", () => {
  it.each([
    [{ years: 0 }, "years"],
    [{ years: 2.5 }, "years"],
    [{ monthlyCents: -1 }, "monthlyCents"],
    [{ initialCents: 10.5 }, "initialCents"],
    [{ annualReturnPct: Number.NaN }, "annualReturnPct"],
    [{ annualFeePct: 6 }, "annualFeePct"],
  ] as const)("rejects %j", (patch, field) => {
    expect(() => project({ ...flat, ...patch })).toThrow(expect.objectContaining({ field }));
  });

  it("refuses inputs that would overflow exact integer maths", () => {
    expect(() => project({ ...flat, initialCents: 100_000_000_00, annualReturnPct: 30, years: 60 })).toThrow(PlanError);
  });
});

describe("solveMonthly", () => {
  it("finds the smallest monthly amount, to the cent, that reaches the goal", () => {
    const plan = { ...flat, annualReturnPct: 10, years: 20 };
    const result = solveMonthly(plan, 1_000_000_00, false);
    expect(result.kind).toBe("monthly");
    if (result.kind !== "monthly") return;
    expect(project({ ...plan, monthlyCents: result.monthlyCents }).finalCents).toBeGreaterThanOrEqual(1_000_000_00);
    expect(project({ ...plan, monthlyCents: result.monthlyCents - 1 }).finalCents).toBeLessThan(1_000_000_00);
  });

  it("solves in today's money", () => {
    const plan = { ...flat, annualReturnPct: 10, inflationPct: 6, years: 20 };
    const nominal = solveMonthly(plan, 1_000_000_00, false);
    const real = solveMonthly(plan, 1_000_000_00, true);
    if (nominal.kind !== "monthly" || real.kind !== "monthly") throw new Error("expected solutions");
    expect(real.monthlyCents).toBeGreaterThan(nominal.monthlyCents);
  });

  it("says when the lump sum is enough or when TFSA limits make the goal impossible", () => {
    expect(solveMonthly({ ...flat, initialCents: 2_000_000_00 }, 1_000_000_00, false)).toEqual({ kind: "already_met" });
    const capped = solveMonthly({ ...flat, taxFree: true, years: 5 }, 5_000_000_00, false);
    expect(capped).toMatchObject({ kind: "unreachable", reason: expect.stringMatching(/TFSA/) });
  });
});

describe("URL state", () => {
  it("round-trips a plan", () => {
    const plan: Plan = { ...DEFAULT_PLAN, monthlyCents: 3_456_78, taxFree: true, annualFeePct: 0.85 };
    expect(planFromQuery(planToQuery(plan))).toEqual(plan);
  });

  it("falls back or clamps on hostile or broken values", () => {
    const plan = planFromQuery("?years=999&fees=-3&return=abc&monthly=1e99&initial=&tfsa=yes");
    expect(plan).toMatchObject({ years: 60, annualFeePct: 0, annualReturnPct: DEFAULT_PLAN.annualReturnPct, initialCents: DEFAULT_PLAN.initialCents, taxFree: false });
    expect(plan.monthlyCents).toBe(100_000_000_00);
    expect(() => project(plan)).not.toThrow(TypeError);
  });
});

describe("formatting", () => {
  it("formats rands the South African way", () => {
    expect(formatRands(123_456_789)).toBe("R 1 234 568");
  });
});
