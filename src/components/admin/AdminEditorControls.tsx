"use client";

import { useState } from "react";

export function AdminRangeField({
  className,
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  editableValue = false,
  onChange,
}: {
  className?: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  editableValue?: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const normalize = (raw: number) =>
    Math.min(
      max,
      Math.max(
        min,
        Math.round(raw / step) * step
      )
    );

  const finish = () => {
    const parsed =
      draft === null || !draft.trim()
        ? value
        : Number(draft);
    if (Number.isFinite(parsed)) {
      onChange(normalize(parsed));
    }
    setDraft(null);
  };

  return (
    <label className={className}>
      <span>{label}</span>
      <div>
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) =>
            onChange(Number(event.target.value))
          }
        />
        <b>
          {editableValue ? (
            <input
              type="number"
              aria-label={`${label}: valor numérico`}
              min={min}
              max={max}
              step={step}
              value={draft ?? value}
              onChange={(event) =>
                setDraft(event.target.value)
              }
              onBlur={finish}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  setDraft(null);
                }
              }}
            />
          ) : (
            value
          )}
          {unit}
        </b>
      </div>
    </label>
  );
}

export function AdminSwitchField({
  className,
  label,
  value,
  onChange,
}: {
  className?: string;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={className}>
      <span>{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(event) =>
          onChange(event.target.checked)
        }
      />
      <i aria-hidden="true" />
    </label>
  );
}
