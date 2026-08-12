/** All engine amounts are integer cents. Conversions to and from rands happen only at the UI edge. */

export function randsToCents(rands: number): number {
  if (!Number.isFinite(rands)) throw new RangeError(`Not a number: ${rands}`);
  return Math.round(rands * 100);
}

export function centsToRands(cents: number): number {
  return cents / 100;
}

const zar = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 });
const zarCents = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 });

/** "R 1 234 567" (whole rands). Normalises the non-breaking spaces Intl uses, so output is stable across runtimes. */
export function formatRands(cents: number): string {
  return zar.format(Math.round(cents / 100)).replace(/\s/g, " ");
}

export function formatRandsCents(cents: number): string {
  return zarCents.format(cents / 100).replace(/\s/g, " ");
}
