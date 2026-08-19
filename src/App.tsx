import { useEffect, useMemo, useState } from "react";
import { GoalSolver } from "./components/GoalSolver";
import { GrowthChart } from "./components/GrowthChart";
import { PlanForm } from "./components/PlanForm";
import { formatRands } from "./engine/money";
import { PlanError, project, type Plan, type Projection } from "./engine/projection";
import { planFromQuery, planToQuery } from "./engine/urlState";

export function App() {
  const [plan, setPlan] = useState<Plan>(() => planFromQuery(window.location.search));

  // Keep the URL in step so a scenario can be bookmarked or shared.
  useEffect(() => {
    window.history.replaceState(null, "", `?${planToQuery(plan)}`);
  }, [plan]);

  const outcome = useMemo((): { ok: true; projection: Projection } | { ok: false; message: string } => {
    try {
      return { ok: true, projection: project(plan) };
    } catch (err) {
      if (err instanceof PlanError) return { ok: false, message: err.message };
      throw err;
    }
  }, [plan]);

  return (
    <div className="layout">
      <header>
        <h1>Investment calculator</h1>
        <p className="lede">Project a South African savings plan month by month, after fees and inflation.</p>
      </header>
      <PlanForm plan={plan} onChange={setPlan} />
      {outcome.ok ? <Results plan={plan} p={outcome.projection} /> : <p role="alert" className="error">{outcome.message}</p>}
      <GoalSolver plan={plan} onUse={(monthlyCents) => setPlan({ ...plan, monthlyCents })} />
      <footer className="hint">
        Illustration only, not financial advice. Returns are not guaranteed. Each plan year is treated as one tax year for TFSA limits.
      </footer>
    </div>
  );
}

function Results({ plan, p }: { plan: Plan; p: Projection }) {
  return (
    <section aria-labelledby="results-heading">
      <h2 id="results-heading">After {plan.years} years</h2>
      <dl className="summary">
        <div>
          <dt>Balance</dt>
          <dd data-testid="final">{formatRands(p.finalCents)}</dd>
        </div>
        <div>
          <dt>In today’s money</dt>
          <dd data-testid="real">{formatRands(p.realFinalCents)}</dd>
        </div>
        <div>
          <dt>You contributed</dt>
          <dd>{formatRands(p.totalContributedCents)}</dd>
        </div>
        <div>
          <dt>Growth</dt>
          <dd>{formatRands(p.totalGrowthCents)}</dd>
        </div>
        <div>
          <dt>Fees paid</dt>
          <dd data-testid="fees">{formatRands(p.totalFeesCents)}</dd>
        </div>
      </dl>
      {p.totalHeldBackCents > 0 ? (
        <p className="notice" role="status" data-testid="tfsa-notice">
          {formatRands(p.totalHeldBackCents)} of planned contributions were held back to stay within the TFSA limits.
          Contributing it anyway would cost {formatRands(p.penaltyAvoidedCents)} in SARS penalty tax (40%). Consider a second, taxable investment for the extra.
        </p>
      ) : null}
      <GrowthChart rows={p.rows} />
      <details>
        <summary>Year-by-year breakdown</summary>
        <table>
          <caption className="sr-only">Balance by year</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Contributed</th>
              <th scope="col">Growth</th>
              <th scope="col">Fees</th>
              <th scope="col">Balance</th>
              <th scope="col">Today’s money</th>
            </tr>
          </thead>
          <tbody>
            {p.rows.map((r) => (
              <tr key={r.year}>
                <th scope="row">{r.year}</th>
                <td>{formatRands(r.contributedCents)}</td>
                <td>{formatRands(r.growthCents)}</td>
                <td>{formatRands(r.feesCents)}</td>
                <td>{formatRands(r.endBalanceCents)}</td>
                <td>{formatRands(r.realEndBalanceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
