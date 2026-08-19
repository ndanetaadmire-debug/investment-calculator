import { useId, useState } from "react";

interface Props {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly suffix?: string;
  readonly prefix?: string;
  readonly hint?: string;
}

/**
 * Number input that lets people type freely (including an empty box or a
 * trailing "."), shows an inline error for out-of-range values, and only
 * reports valid numbers upwards. The original used raw strings from
 * event.target.value straight in the maths, so "" became 0 and "1e9" was accepted.
 */
export function NumberField({ label, value, onChange, min, max, step = 1, suffix, prefix, hint }: Props) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const [lastValue, setLastValue] = useState(value);

  // Sync when the value changes from outside (e.g. "Use this amount" from the goal solver).
  if (value !== lastValue) {
    setLastValue(value);
    setText(String(value));
    setError(null);
  }

  function handle(raw: string) {
    setText(raw);
    const n = Number(raw.replace(/[\s,]/g, ""));
    if (raw.trim() === "" || !Number.isFinite(n)) return setError("Enter a number");
    if (n < min || n > max) return setError(`Must be between ${min.toLocaleString("en-ZA")} and ${max.toLocaleString("en-ZA")}`);
    setError(null);
    setLastValue(n);
    onChange(n);
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        {prefix ? <span aria-hidden="true">{prefix}</span> : null}
        <input
          id={id}
          inputMode="decimal"
          value={text}
          step={step}
          aria-invalid={error !== null}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          onChange={(e) => handle(e.target.value)}
        />
        {suffix ? <span aria-hidden="true">{suffix}</span> : null}
      </div>
      {error ? (
        <p id={`${id}-err`} className="error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
