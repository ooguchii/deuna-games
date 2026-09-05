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
  spacingReference,
  linked,
  onChangeBefore,
  onChangeAfter,
  onReferenceChange,
  onLinkedChange,
  onPreset,
  onRestore,
}: {
  deviceLabel: string;
  spaceBefore: number;
  spaceAfter: number;
  spacingReference: "visual" | "canvas";
  linked: boolean;
  onChangeBefore: (value: number) => void;
  onChangeAfter: (value: number) => void;
  onReferenceChange: (value: "visual" | "canvas") => void;
  onLinkedChange: (value: boolean) => void;
  onPreset: (spaceBefore: number, spaceAfter: number) => void;
  onRestore: () => void;
}) {
  return <>
    <p className={styles.help}><strong>Espaciado exterior real del Hero.</strong> Con <strong>Contenido visible</strong>, la distancia se calcula desde lo que realmente queda renderizado después del fitting, incluidas las tarjetas y los controles del carrusel. Así 0px sigue siendo 0px aunque cambie la resolución. Usa <strong>Lienzo del Hero</strong> sólo si quieres conservar deliberadamente el aire interno del encuadre.</p>
    <label className={styles.select}>
      <span>Referencia del espaciado</span>
      <select value={spacingReference} onChange={(event) => onReferenceChange(event.target.value as "visual" | "canvas")}>
        <option value="visual">Contenido visible · recomendado</option>
        <option value="canvas">Lienzo del Hero</option>
      </select>
    </label>
    <label className={styles.switch}>
      <span>Mismo espaciado en todos los dispositivos</span>
      <input type="checkbox" checked={linked} onChange={(event) => onLinkedChange(event.target.checked)} />
      <i />
    </label>
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
    <button type="button" onClick={onRestore}><RotateCcw size={14} /> Restablecer espaciado de {linked ? "todos los dispositivos" : deviceLabel.toLowerCase()}</button>
  </>;
}
