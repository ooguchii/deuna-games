"use client";

import { RotateCcw } from "lucide-react";

import type {
  HomeHeroNavigationConfig,
  HomeHeroNavigationPlacement,
  HomeHeroNavigationStyle,
} from "@/data/home-config";

import styles from "./HomeHeroNavigationControls.module.css";

const stylesCatalog: Array<{
  id: HomeHeroNavigationStyle;
  title: string;
  description: string;
}> = [
  { id: "segmented-pro", title: "Segmentada Pro", description: "La barra limpia usada como referencia en la prueba." },
  { id: "integrated", title: "Progreso integrado", description: "El segmento activo se llena con el tiempo." },
  { id: "pills", title: "Píldoras", description: "Compacta y redondeada." },
  { id: "dots", title: "Puntos premium", description: "Mínima, con activo en cápsula." },
  { id: "timeline", title: "Timeline", description: "Lectura lineal y cinematográfica." },
  { id: "minimal", title: "Minimal", description: "Sólo lo esencial, casi sin contenedor." },
  { id: "glass", title: "Glass", description: "Controles dentro de una cápsula translúcida." },
  { id: "rail", title: "Rail", description: "Muescas sobre una guía continua." },
];

const anchorPresets = [
  { label: "↖", title: "Arriba izquierda", x: 12, y: 12 },
  { label: "↑", title: "Arriba centro", x: 50, y: 12 },
  { label: "↗", title: "Arriba derecha", x: 88, y: 12 },
  { label: "←", title: "Centro izquierda", x: 12, y: 50 },
  { label: "•", title: "Centro", x: 50, y: 50 },
  { label: "→", title: "Centro derecha", x: 88, y: 50 },
  { label: "↙", title: "Abajo izquierda", x: 12, y: 90 },
  { label: "↓", title: "Abajo centro", x: 50, y: 90 },
  { label: "↘", title: "Abajo derecha", x: 88, y: 90 },
] as const;

function NumberRange({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className={styles.range}>
      <span>{label}</span>
      <div>
        <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <b>{value}{unit}</b>
      </div>
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className={styles.toggle}>
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
      <i />
    </label>
  );
}

export default function HomeHeroNavigationControls({
  navigation,
  placement,
  deviceLabel,
  onStyleChange,
  onToggle,
  onPlacementChange,
  onPositionChange,
  onRestore,
}: {
  navigation: HomeHeroNavigationConfig;
  placement: HomeHeroNavigationPlacement;
  deviceLabel: string;
  onStyleChange: (style: HomeHeroNavigationStyle) => void;
  onToggle: (key: "showIndicators" | "showPause" | "showProgress", value: boolean) => void;
  onPlacementChange: (key: keyof HomeHeroNavigationPlacement, value: number) => void;
  onPositionChange: (x: number, y: number) => void;
  onRestore: () => void;
}) {
  return (
    <div className={styles.editor}>
      <p>Un único sistema se usa en la preview y en Inicio. Cambiar el estilo no altera el autoplay ni la selección de juegos.</p>

      <strong className={styles.sectionTitle}>Estilo</strong>
      <div className={styles.styleGrid}>
        {stylesCatalog.map((entry) => (
          <button
            key={entry.id}
            type="button"
            data-active={navigation.style === entry.id}
            onClick={() => onStyleChange(entry.id)}
          >
            <span className={styles.mini} data-style={entry.id} aria-hidden="true"><i /><i /><i /><i /></span>
            <strong>{entry.title}</strong>
            <small>{entry.description}</small>
          </button>
        ))}
      </div>

      <strong className={styles.sectionTitle}>Elementos</strong>
      <Toggle label="Indicadores de juegos" value={navigation.showIndicators} onChange={(value) => onToggle("showIndicators", value)} />
      <Toggle label="Botón pausa / reanudar" value={navigation.showPause} onChange={(value) => onToggle("showPause", value)} />
      <Toggle label="Progreso del autoplay" value={navigation.showProgress} onChange={(value) => onToggle("showProgress", value)} />

      <strong className={styles.sectionTitle}>Posición en {deviceLabel}</strong>
      <div className={styles.anchorGrid} role="group" aria-label={`Posiciones rápidas para ${deviceLabel}`}>
        {anchorPresets.map((entry) => (
          <button
            key={entry.title}
            type="button"
            title={entry.title}
            aria-label={entry.title}
            data-active={Math.abs(placement.x - entry.x) <= 1 && Math.abs(placement.y - entry.y) <= 1}
            onClick={() => onPositionChange(entry.x, entry.y)}
          >{entry.label}</button>
        ))}
      </div>
      <p className={styles.hint}>También puedes arrastrar el manejador que aparece sobre la barra en la preview. Shift + flechas mueve de a 5%.</p>
      <NumberRange label="Posición X" value={placement.x} min={0} max={100} unit="%" onChange={(value) => onPlacementChange("x", value)} />
      <NumberRange label="Posición Y" value={placement.y} min={0} max={100} unit="%" onChange={(value) => onPlacementChange("y", value)} />
      <NumberRange label="Escala" value={placement.scale} min={50} max={180} unit="%" onChange={(value) => onPlacementChange("scale", value)} />

      <button type="button" className={styles.restore} onClick={onRestore}>
        <RotateCcw size={14} aria-hidden="true" /> Restablecer controles de {deviceLabel.toLowerCase()}
      </button>
    </div>
  );
}
