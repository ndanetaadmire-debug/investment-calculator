import type { YearRow } from "../engine/projection";
import { formatRands } from "../engine/money";

const W = 640;
const H = 260;
const PAD = { top: 12, right: 12, bottom: 28, left: 72 };

/**
 * Stacked area chart (contributions vs growth) in plain SVG: no chart
 * library for one chart. The summary table below carries the same numbers
 * for screen-reader users.
 */
export function GrowthChart({ rows }: { rows: readonly YearRow[] }) {
  if (rows.length === 0) return null;
  const maxY = Math.max(1, ...rows.map((r) => Math.max(r.endBalanceCents, r.totalContributedCents)));
  const x = (i: number) => PAD.left + (rows.length === 1 ? 0 : (i / (rows.length - 1)) * (W - PAD.left - PAD.right));
  const y = (v: number) => H - PAD.bottom - (Math.max(0, v) / maxY) * (H - PAD.top - PAD.bottom);
  const line = (pick: (r: YearRow) => number) => rows.map((r, i) => `${x(i).toFixed(1)},${y(pick(r)).toFixed(1)}`).join(" ");
  const base = `${x(rows.length - 1).toFixed(1)},${y(0)} ${x(0).toFixed(1)},${y(0)}`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxY);
  const last = rows.at(-1)!;

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Balance grows to ${formatRands(last.endBalanceCents)} after ${last.year} years, of which ${formatRands(last.totalContributedCents)} is contributions.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="tick">
              {formatRands(t)}
            </text>
          </g>
        ))}
        <polygon points={`${line((r) => r.endBalanceCents)} ${base}`} className="area-growth" />
        <polygon points={`${line((r) => r.totalContributedCents)} ${base}`} className="area-contrib" />
        <text x={x(0)} y={H - 8} className="tick">Year 1</text>
        <text x={x(rows.length - 1)} y={H - 8} textAnchor="end" className="tick">Year {last.year}</text>
      </svg>
      <figcaption>
        <span className="key key-contrib" /> Your contributions <span className="key key-growth" /> Growth after fees
      </figcaption>
    </figure>
  );
}
