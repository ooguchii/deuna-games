"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";

import styles from "./HomeHeroEditor.module.css";

const spacingPresets = [
  { id: "flush", label: "Sin espacio", before: 0, after: 0 },
  { id: "compact", label: "Compacto", before: 12, after: 24 },
  { id: "balanced", label: "Equilibrado", before: 28, after: 48 },
  { id: "spacious", label: "Amplio", before: 44, after: 80 },
] as const;

function SpacingRange({ label, value, max, change }: {
  label: string;
  value: number;
  max: number;
  change: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const finish = () => {
    const number = draft === null || !draft.trim() ? value : Number(draft);
    if (Number.isFinite(number)) change(Math.min(max, Math.max(0, Math.round(number))));
    setDraft(null);
  };

  return <label className={styles.range}>
    <span>{label}</span>
    <div>
      <input type="range" aria-label={label} min={0} max={max} step={1} value={value} onChange={(event) => change(Number(event.target.value))} />
      <b>
        <input
          type="number"
          aria-label={`${label}: valor numérico`}
          min={0}
          max={max}
          step={1}
          value={draft ?? value}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={finish}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") setDraft(null);
          }}
        />
        px
      </b>
    </div>
  </label>;
}

export default function HomeHeroSpacingControls({
  deviceLabel,
  spaceBefore,
  spaceAfter,
  onChangeBefore,
  onChangeAfter,
  onPreset,
  onRestore,
}: {
  deviceLabel: string;
  spaceBefore: number;
  spaceAfter: number;
  onChangeBefore: (value: number) => void;
  onChangeAfter: (value: number) => void;
  onPreset: (spaceBefore: number, spaceAfter: number) => void;
  onRestore: () => void;
}) {
  return <>
    <p className={styles.help}><strong>Espaciado exterior real del Hero.</strong> Define la distancia respecto del contenido anterior y de la sección que venga después. Si el Hero es la primera sección, 0px significa que no se añade separación bajo el encabezado. El contenedor ya no reserva aire vertical oculto: su altura real la determina el control <strong>Alto</strong> de la tarjeta.</p>
    <SpacingRange label="Espacio superior" value={spaceBefore} max={160} change={onChangeBefore} />
    <SpacingRange label="Espacio inferior" value={spaceAfter} max={200} change={onChangeAfter} />
    <div role="group" aria-label={`Presets de espaciado para ${deviceLabel}`}>
      {spacingPresets.map((preset) => <button
        type="button"
        className={styles.breakpoint}
        key={preset.id}
        data-active={spaceBefore === preset.before && spaceAfter === preset.after}
        onClick={() => onPreset(preset.before, preset.after)}
      >
        {preset.label}<small>{preset.before}px arriba · {preset.after}px abajo</small>
      </button>)}
    </div>
    <button type="button" onClick={onRestore}><RotateCcw size={14} /> Restablecer espaciado de {deviceLabel.toLowerCase()}</button>
  </>;
}
