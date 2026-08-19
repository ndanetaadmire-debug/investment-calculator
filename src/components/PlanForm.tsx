import { LIMITS, type Plan } from "../engine/projection";
import { TFSA } from "../engine/tfsa";
import { formatRands } from "../engine/money";
import { NumberField } from "./NumberField";

const MAX_RANDS = LIMITS.maxAmountCents / 100;

export function PlanForm({ plan, onChange }: { plan: Plan; onChange: (plan: Plan) => void }) {
  const set = <K extends keyof Plan>(key: K) => (value: Plan[K]) => onChange({ ...plan, [key]: value });
  const rands = (key: "initialCents" | "monthlyCents") => (value: number) => onChange({ ...plan, [key]: Math.round(value * 100) });

  return (
    <form className="plan-form" onSubmit={(e) => e.preventDefault()} aria-label="Investment plan">
      <fieldset>
        <legend>Contributions</legend>
        <NumberField label="Lump sum today" prefix="R" value={plan.initialCents / 100} min={0} max={MAX_RANDS} onChange={rands("initialCents")} />
        <NumberField label="Monthly contribution" prefix="R" value={plan.monthlyCents / 100} min={0} max={MAX_RANDS} onChange={rands("monthlyCents")} />
        <NumberField
          label="Yearly increase in contributions"
          suffix="%"
          step={0.5}
          value={plan.annualEscalationPct}
          {...LIMITS.annualEscalationPct}
          onChange={set("annualEscalationPct")}
          hint="Raise your debit order each year, e.g. with your salary."
        />
        <NumberField label="Years" value={plan.years} {...LIMITS.years} onChange={(v) => set("years")(Math.round(v))} />
      </fieldset>
      <fieldset>
        <legend>Assumptions</legend>
        <NumberField label="Expected return per year (before fees)" suffix="%" step={0.5} value={plan.annualReturnPct} {...LIMITS.annualReturnPct} onChange={set("annualReturnPct")} />
        <NumberField label="Total fees per year" suffix="%" step={0.05} value={plan.annualFeePct} {...LIMITS.annualFeePct} onChange={set("annualFeePct")} hint="Fund TER plus any advice or platform fee." />
        <NumberField label="Inflation per year" suffix="%" step={0.5} value={plan.inflationPct} {...LIMITS.inflationPct} onChange={set("inflationPct")} />
        <label className="checkbox">
          <input type="checkbox" checked={plan.taxFree} onChange={(e) => set("taxFree")(e.target.checked)} />
          Tax-free savings account (caps contributions at {formatRands(TFSA.annualLimitCents)} a year and {formatRands(TFSA.lifetimeLimitCents)} lifetime)
        </label>
      </fieldset>
    </form>
  );
}
