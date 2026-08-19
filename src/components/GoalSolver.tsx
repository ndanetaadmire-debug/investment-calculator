import { useMemo, useState } from "react";
import { solveMonthly, type Plan } from "../engine/projection";
import { formatRands, formatRandsCents } from "../engine/money";
import { NumberField } from "./NumberField";

export function GoalSolver({ plan, onUse }: { plan: Plan; onUse: (monthlyCents: number) => void }) {
  const [targetRands, setTargetRands] = useState(1_000_000);
  const [todaysMoney, setTodaysMoney] = useState(true);
  const result = useMemo(() => solveMonthly(plan, Math.round(targetRands * 100), todaysMoney), [plan, targetRands, todaysMoney]);

  return (
    <section className="card" aria-labelledby="goal-heading">
      <h2 id="goal-heading">What do I need to save?</h2>
      <NumberField label="Target amount" prefix="R" value={targetRands} min={1} max={100_000_000} onChange={setTargetRands} />
      <label className="checkbox">
        <input type="checkbox" checked={todaysMoney} onChange={(e) => setTodaysMoney(e.target.checked)} />
        Target is in today’s money (adjusted for inflation)
      </label>
      <p aria-live="polite" className="goal-result">
        {result.kind === "already_met" && <>Your lump sum alone gets there. No monthly contribution needed.</>}
        {result.kind === "monthly" && (
          <>
            Start at <strong>{formatRandsCents(result.monthlyCents)}</strong> a month
            {plan.annualEscalationPct > 0 ? `, rising ${plan.annualEscalationPct}% a year,` : ""} to reach {formatRands(Math.round(targetRands * 100))} in {plan.years} years.{" "}
            <button type="button" onClick={() => onUse(result.monthlyCents)}>
              Use this amount
            </button>
          </>
        )}
        {result.kind === "unreachable" && <>{result.reason}</>}
      </p>
    </section>
  );
}
