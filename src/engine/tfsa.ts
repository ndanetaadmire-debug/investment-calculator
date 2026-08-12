/**
 * South African tax-free savings account (TFSA) rules, per SARS:
 *  - annual contribution limit R46 000 from 1 March 2026 (R36 000 for 2021–2026),
 *  - lifetime contribution limit R500 000,
 *  - excess contributions are taxed at 40%.
 * Growth inside the account never counts towards either limit.
 * Source: https://www.sars.gov.za/types-of-tax/personal-income-tax/tax-free-investments/
 */
export const TFSA = {
  annualLimitCents: 46_000_00,
  lifetimeLimitCents: 500_000_00,
  excessTaxRate: 0.4,
  effectiveFrom: "2026-03-01",
} as const;

export interface TfsaState {
  readonly contributedThisYearCents: number;
  readonly contributedLifetimeCents: number;
}

/** How much of a proposed contribution fits under both limits right now. */
export function allowedContribution(proposedCents: number, state: TfsaState): number {
  const annualRoom = Math.max(0, TFSA.annualLimitCents - state.contributedThisYearCents);
  const lifetimeRoom = Math.max(0, TFSA.lifetimeLimitCents - state.contributedLifetimeCents);
  return Math.max(0, Math.min(proposedCents, annualRoom, lifetimeRoom));
}

/** The 40% tax SARS would levy if `excessCents` were contributed over the limits anyway. */
export function excessPenalty(excessCents: number): number {
  return Math.round(Math.max(0, excessCents) * TFSA.excessTaxRate);
}
