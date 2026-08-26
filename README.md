# Investment calculator (South Africa)

[![CI](https://github.com/ndanetaadmire-debug/investment-calculator/actions/workflows/ci.yml/badge.svg)](https://github.com/ndanetaadmire-debug/investment-calculator/actions/workflows/ci.yml)

A savings and investment planner built with React 19, TypeScript and Vite. It projects a plan **month by month** after **fees** and **inflation**, applies the **tax-free savings account (TFSA) limits** SARS sets, and works out the monthly amount you need to reach a goal.

> **Where this came from.** My first version was a CodeSandbox exercise from a React course. It applied the yearly return once a year, used floating-point dollars, ignored fees and inflation, and fed raw input strings into the maths. This repo is the version I'd put in front of a user: the same idea with a tested financial engine.

## What it does

- **Monthly compounding at the correct rate.** The annual return is converted with `(1 + r)^(1/12) − 1`, not `r / 12`, so a 10% year really is 10%.
- **Fees.** Total annual fees (fund TER plus advice) are deducted monthly. The summary shows the rand cost, and a test shows a 1% fee difference costs about a fifth of the final balance over 30 years.
- **Inflation.** Every result is also shown in today's money.
- **Escalation.** Monthly contributions rise each year, the way most people's debit orders do.
- **TFSA limits** (from [SARS](https://www.sars.gov.za/types-of-tax/personal-income-tax/tax-free-investments/)): R46 000 a year from 1 March 2026 and R500 000 lifetime. Contributions are capped, the lump sum counts towards year one, and the app shows how much was held back and the 40% penalty tax that would have been due on it. Growth doesn't count towards the limits.
- **Goal solver.** Finds the smallest starting monthly contribution, to the cent, that reaches a target in nominal terms or in today's money. It tells you when the lump sum is already enough, or when the TFSA limits make the target impossible.
- **Shareable scenarios.** The plan lives in the URL. Hand-edited or hostile query strings are clamped to safe values.
- **Accessible.** Labelled inputs with inline errors (`aria-invalid`, `role="alert"`), an SVG chart with a text description, and a full year-by-year table.

## How the engine works

```
src/engine/
  projection.ts   project(plan) → yearly rows and totals;  solveMonthly(plan, target)
  tfsa.ts         SARS limits, allowedContribution(), excessPenalty()
  money.ts        cents ⇄ rands, ZAR formatting
  urlState.ts     plan ⇄ query string with clamping
```

All amounts are **integer cents**, rounded once per month like a real statement. That makes the books balance exactly: `final = contributions + growth − fees`, which a property test checks on thousands of random plans. Inputs that would grow past 2⁵³ cents are refused rather than shown inexactly.

The solver uses binary search, which is exact because the final balance never decreases as the contribution grows. Property testing found one exception: in a TFSA, with fees above returns, contributing more can hit the annual cap earlier, and money that arrives earlier pays more in fees. That's real economics, and it's documented in the test and the code.

## Tests

```bash
npm install
npm test          # 35 tests: worked examples, fast-check properties, UI behaviour
npm run dev       # http://localhost:5173
npm run build
```

| Kind | Examples |
|---|---|
| Worked examples | 0% return is plain addition; a lump sum compounds to exactly 10%; agrees with the annuity-due closed form; escalation; deflation |
| Properties (fast-check) | Books always reconcile; a TFSA never exceeds its limits; more saving never ends with less (uncapped); higher fees never end with more; today's money ≤ nominal |
| TFSA | Annual cap, lump sum counting towards year one, lifetime cap reached while growth continues, penalty maths |
| UI (Testing Library) | Recalculates on typing, URL sync, inline validation that keeps the last good result, loading shared scenarios, TFSA warning, applying the goal solver's answer |

*This is an illustration, not financial advice. Returns are not guaranteed. Each plan year is treated as one tax year for TFSA purposes.*

## License

MIT © Admire T. Ndaneta
