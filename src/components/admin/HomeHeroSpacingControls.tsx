"use client";

import { RotateCcw } from "lucide-react";

import {
  AdminRangeField,
  AdminSwitchField,
} from "@/components/admin/AdminEditorControls";

import styles from "./HomeHeroEditor.module.css";

const spacingPresets = [
  { id: "flush", label: "Sin espacio", before: 0, after: 0 },
  { id: "compact", label: "Compacto", before: 12, after: 24 },
  { id: "balanced", label: "Equilibrado", before: 28, after: 48 },
  { id: "spacious", label: "Amplio", before: 44, after: 80 },
] as const;

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
  const restoreSpacing = () => {
    // Restoring all devices returns each one to its own saved baseline. Those
    // baselines may intentionally differ, so keeping the link switch enabled
    // would claim a relationship that is no longer true.
    if (linked) onLinkedChange(false);
    onRestore();
  };

  return (
    <>
      <p className={styles.help}>
        <strong>Espaciado exterior real del Hero.</strong> Con{" "}
        <strong>Contenido visible</strong>, la distancia se calcula desde lo que realmente queda renderizado después del fitting, incluidas las tarjetas y los controles del carrusel. Así 0px sigue siendo 0px aunque cambie la resolución. Usa{" "}
        <strong>Lienzo del Hero</strong> sólo si quieres conservar deliberadamente el aire interno del encuadre.
      </p>
      <label className={styles.select}>
        <span>Referencia del espaciado</span>
        <select
          value={spacingReference}
          onChange={(event) =>
            onReferenceChange(
              event.target.value as "visual" | "canvas"
            )
          }
        >
          <option value="visual">Contenido visible · recomendado</option>
          <option value="canvas">Lienzo del Hero</option>
        </select>
      </label>
      <AdminSwitchField
        className={styles.switch}
        label="Mismo espaciado en todos los dispositivos"
        value={linked}
        onChange={onLinkedChange}
      />
      <AdminRangeField
        className={styles.range}
        label="Espacio superior"
        value={spaceBefore}
        min={0}
        max={160}
        step={1}
        unit="px"
        editableValue
        onChange={onChangeBefore}
      />
      <AdminRangeField
        className={styles.range}
        label="Espacio inferior"
        value={spaceAfter}
        min={0}
        max={200}
        step={1}
        unit="px"
        editableValue
        onChange={onChangeAfter}
      />
      <div
        role="group"
        aria-label={`Presets de espaciado para ${deviceLabel}`}
      >
        {spacingPresets.map((preset) => (
          <button
            type="button"
            className={styles.breakpoint}
            key={preset.id}
            data-active={
              spaceBefore === preset.before &&
              spaceAfter === preset.after
            }
            onClick={() =>
              onPreset(preset.before, preset.after)
            }
          >
            {preset.label}
            <small>
              {preset.before}px arriba · {preset.after}px abajo
            </small>
          </button>
        ))}
      </div>
      <button type="button" onClick={restoreSpacing}>
        <RotateCcw size={14} aria-hidden="true" /> Restablecer espaciado de{" "}
        {linked
          ? "todos los dispositivos"
          : deviceLabel.toLowerCase()}
      </button>
    </>
  );
}
