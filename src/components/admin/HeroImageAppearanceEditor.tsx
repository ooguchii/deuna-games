"use client";

import {
  type CSSProperties,
  useState,
} from "react";

import {
  resolveHeroImageTuning,
  type HeroImageTuning,
} from "@/lib/site/hero-image";

import adminStyles from "../../app/admin/admin.module.css";
import styles from "./HeroImageAppearanceEditor.module.css";

type HeroImageAppearanceEditorProps = {
  revision: number;
  enabled?: boolean;
  tuning?: Partial<HeroImageTuning>;
  previewImage?: string;
  previewTitle?: string;
};

type SliderProps = {
  label: string;
  name: keyof HeroImageTuning;
  value: number;
  min: number;
  max: number;
  unit?: string;
  hint?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
};

type HeroPreset = {
  label: string;
  description: string;
  enabled: boolean;
  tuning: HeroImageTuning;
};

const presets: HeroPreset[] = [
  {
    label: "Limpio",
    description: "Nítido, sin halo ni fundido",
    enabled: false,
    tuning: {
      brightness: 105,
      saturation: 100,
      contrast: 102,
      ambientBlur: 54,
      ambientOpacity: 42,
      overlayStrength: 100,
    },
  },
  {
    label: "Luminoso",
    description: "Mucho más brillo y color",
    enabled: false,
    tuning: {
      brightness: 150,
      saturation: 112,
      contrast: 98,
      ambientBlur: 54,
      ambientOpacity: 42,
      overlayStrength: 100,
    },
  },
  {
    label: "Cinemático",
    description: "Halo equilibrado y texto protegido",
    enabled: true,
    tuning: {
      brightness: 105,
      saturation: 116,
      contrast: 105,
      ambientBlur: 52,
      ambientOpacity: 40,
      overlayStrength: 78,
    },
  },
  {
    label: "Atmosférico",
    description: "Halo amplio con más presencia",
    enabled: true,
    tuning: {
      brightness: 118,
      saturation: 128,
      contrast: 104,
      ambientBlur: 72,
      ambientOpacity: 54,
      overlayStrength: 68,
    },
  },
];

function Slider({
  label,
  name,
  value,
  min,
  max,
  unit = "%",
  hint,
  disabled = false,
  onChange,
}: SliderProps) {
  const progress = ((value - min) / (max - min)) * 100;

  return (
    <label className={styles.slider} data-disabled={disabled}>
      <span className={styles.sliderTop}>
        <strong>{label}</strong>
        <output htmlFor={`hero-${name}`}>
          {value}{unit}
        </output>
      </span>
      <input
        id={`hero-${name}`}
        type="range"
        name={name}
        min={min}
        max={max}
        step="1"
        value={value}
        disabled={disabled}
        style={{ "--range-progress": `${progress}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
}

export default function HeroImageAppearanceEditor({
  revision,
  enabled: initialEnabled = false,
  tuning: initialTuning,
  previewImage,
  previewTitle = "Hero principal",
}: HeroImageAppearanceEditorProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [tuning, setTuning] = useState<HeroImageTuning>(() =>
    resolveHeroImageTuning(initialTuning)
  );

  function update<Key extends keyof HeroImageTuning>(
    key: Key,
    value: HeroImageTuning[Key]
  ) {
    setTuning((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyPreset(preset: HeroPreset) {
    setEnabled(preset.enabled);
    setTuning(preset.tuning);
  }

  const ambientScale = 1.12 + tuning.ambientBlur / 450;
  const ambientBrightness = Math.round(tuning.brightness * 0.72);
  const ambientSaturation = Math.min(240, Math.round(tuning.saturation * 1.2));
  const imageStyle: CSSProperties = previewImage
    ? { backgroundImage: `url(${JSON.stringify(previewImage)})` }
    : {};

  return (
    <section className={`${adminStyles.editorPanel} ${styles.panel}`}>
      <div className={styles.heading}>
        <span>HERO PRINCIPAL</span>
        <h2>Imagen, luz y efecto ambiental</h2>
        <p>
          El brillo, la saturación y el contraste se pueden usar incluso con el difuminado apagado. El blur, el halo y el fundido sólo actúan cuando activas el efecto ambiental.
        </p>
      </div>

      <form
        className={styles.form}
        method="post"
        action="/api/admin/content/configuration/hero-effect"
      >
        <input type="hidden" name="expectedRevision" value={revision} />

        <div className={styles.workspace}>
          <div className={styles.previewColumn}>
            <div className={styles.previewStage}>
              {enabled && (
                <div className={styles.ambientPreview}>
                  <div
                    className={`${styles.previewArtwork} ${!previewImage ? styles.previewFallback : ""}`}
                    style={{
                      ...imageStyle,
                      opacity: tuning.ambientOpacity / 100,
                      filter: `blur(${tuning.ambientBlur}px) brightness(${ambientBrightness}%) saturate(${ambientSaturation}%) contrast(${tuning.contrast}%)`,
                      transform: `scale(${ambientScale.toFixed(3)})`,
                    }}
                  />
                </div>
              )}

              <div className={styles.heroPreview}>
                <div
                  className={`${styles.previewArtwork} ${!previewImage ? styles.previewFallback : ""}`}
                  style={{
                    ...imageStyle,
                    filter: `brightness(${tuning.brightness}%) saturate(${tuning.saturation}%) contrast(${tuning.contrast}%)`,
                  }}
                />
                {enabled && (
                  <div
                    className={styles.previewOverlay}
                    style={{ opacity: tuning.overlayStrength / 100 }}
                  />
                )}
                <div className={styles.previewCopy}>
                  <span>DESTACADO</span>
                  <strong>{previewTitle}</strong>
                  <p>Así se conserva la lectura sobre la imagen.</p>
                  <i />
                </div>
              </div>
            </div>

            <div className={styles.previewInfo}>
              <div>
                <strong>Vista previa</strong>
                <span>{enabled ? "Efecto ambiental activo" : "Imagen limpia"}</span>
              </div>
              <span className={styles.modeBadge} data-enabled={enabled}>
                {enabled ? "AMBIENTAL" : "LIMPIO"}
              </span>
            </div>
          </div>

          <div className={styles.controlsColumn}>
            <section className={styles.controlBlock}>
              <div className={styles.blockTitle}>
                <span>01</span>
                <div>
                  <strong>Modo del Hero</strong>
                  <p>Decide si quieres sólo la imagen o también el halo difuminado.</p>
                </div>
              </div>

              <div className={styles.modeSwitch}>
                <label data-selected={!enabled}>
                  <input
                    type="radio"
                    name="effect"
                    value="off"
                    checked={!enabled}
                    onChange={() => setEnabled(false)}
                  />
                  <strong>Imagen limpia</strong>
                  <span>Sin blur ni fundido adicional</span>
                </label>
                <label data-selected={enabled}>
                  <input
                    type="radio"
                    name="effect"
                    value="on"
                    checked={enabled}
                    onChange={() => setEnabled(true)}
                  />
                  <strong>Efecto ambiental</strong>
                  <span>Halo, blur y fundido configurables</span>
                </label>
              </div>
            </section>

            <section className={styles.controlBlock}>
              <div className={styles.blockTitle}>
                <span>02</span>
                <div>
                  <strong>Estilos rápidos</strong>
                  <p>Úsalos como punto de partida y después ajusta los sliders.</p>
                </div>
              </div>

              <div className={styles.presets}>
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                  >
                    <strong>{preset.label}</strong>
                    <span>{preset.description}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.controlBlock}>
              <div className={styles.blockTitle}>
                <span>03</span>
                <div>
                  <strong>Ajustes de imagen</strong>
                  <p>Estos tres valores funcionan tanto en modo limpio como ambiental.</p>
                </div>
              </div>

              <div className={styles.sliderGrid}>
                <Slider
                  label="Brillo"
                  name="brightness"
                  value={tuning.brightness}
                  min={50}
                  max={220}
                  hint="100% es el original. El máximo de 220% permite levantar imágenes muy oscuras."
                  onChange={(value) => update("brightness", value)}
                />
                <Slider
                  label="Saturación"
                  name="saturation"
                  value={tuning.saturation}
                  min={0}
                  max={200}
                  onChange={(value) => update("saturation", value)}
                />
                <Slider
                  label="Contraste"
                  name="contrast"
                  value={tuning.contrast}
                  min={70}
                  max={160}
                  onChange={(value) => update("contrast", value)}
                />
              </div>
            </section>

            <section className={styles.controlBlock} data-disabled={!enabled}>
              <div className={styles.blockTitle}>
                <span>04</span>
                <div>
                  <strong>Efecto ambiental</strong>
                  <p>{enabled ? "Controla la intensidad real del efecto." : "Activa Efecto ambiental para editar estos valores."}</p>
                </div>
              </div>

              <div className={styles.sliderGrid}>
                <Slider
                  label="Intensidad del blur"
                  name="ambientBlur"
                  value={tuning.ambientBlur}
                  min={0}
                  max={90}
                  unit=" px"
                  disabled={!enabled}
                  hint="0 px deja el halo definido; 90 px produce un ambiente muy difuso."
                  onChange={(value) => update("ambientBlur", value)}
                />
                <Slider
                  label="Presencia del halo"
                  name="ambientOpacity"
                  value={tuning.ambientOpacity}
                  min={0}
                  max={100}
                  disabled={!enabled}
                  onChange={(value) => update("ambientOpacity", value)}
                />
                <Slider
                  label="Fundido oscuro"
                  name="overlayStrength"
                  value={tuning.overlayStrength}
                  min={0}
                  max={100}
                  disabled={!enabled}
                  hint="0% elimina el fundido; 100% conserva la protección máxima bajo el texto."
                  onChange={(value) => update("overlayStrength", value)}
                />
              </div>

              {!enabled && (
                <>
                  <input type="hidden" name="ambientBlur" value={tuning.ambientBlur} />
                  <input type="hidden" name="ambientOpacity" value={tuning.ambientOpacity} />
                  <input type="hidden" name="overlayStrength" value={tuning.overlayStrength} />
                </>
              )}
            </section>
          </div>
        </div>

        <div className={styles.saveBar}>
          <div>
            <strong>Personalización no destructiva</strong>
            <span>El archivo del juego no se modifica; sólo se guardan estos valores visuales.</span>
          </div>
          <button type="submit">Guardar Hero</button>
        </div>
      </form>
    </section>
  );
}
