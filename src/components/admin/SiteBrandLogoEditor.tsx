"use client";

import {
  ImagePlus,
  Palette,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import {
  type CSSProperties,
  useRef,
  useState,
} from "react";

import SiteLogoMark from "@/components/brand/SiteLogoMark";
import {
  resolveSiteLogoColor,
  type SiteLogoColorMode,
} from "@/lib/site/logo";

import styles from "./SiteBrandLogoEditor.module.css";

type SiteBrandLogoEditorProps = {
  revision: number;
  initialAsset?: string;
  brandColor: string;
  initialColorMode: SiteLogoColorMode;
  initialCustomColor: string;
};

type UploadPayload = {
  publicPath?: string;
  error?: string;
};

export default function SiteBrandLogoEditor({
  revision,
  initialAsset,
  brandColor,
  initialColorMode,
  initialCustomColor,
}: SiteBrandLogoEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [asset, setAsset] = useState(initialAsset ?? "");
  const [colorMode, setColorMode] =
    useState<SiteLogoColorMode>(initialColorMode);
  const [customColor, setCustomColor] =
    useState(initialCustomColor);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const logoColor = resolveSiteLogoColor({
    brandColor,
    logoColorMode: colorMode,
    logoCustomColor: customColor,
  });

  async function uploadLogo(file: File) {
    if (uploading) return;

    setUploading(true);
    setMessage(null);

    try {
      const form = new FormData();
      form.set("expectedRevision", String(revision));
      form.set("logo", file);

      const response = await fetch(
        "/api/admin/content/configuration/logo-upload",
        {
          method: "POST",
          body: form,
          credentials: "same-origin",
        }
      );
      const payload = (await response.json().catch(() => null)) as
        | UploadPayload
        | null;

      if (!response.ok || !payload?.publicPath) {
        setMessage(
          payload?.error ??
            "No se pudo validar el logo."
        );
        return;
      }

      setAsset(payload.publicPath);
      setMessage(
        "Logo validado. Guarda el borrador para incorporarlo a la identidad."
      );
    } catch {
      setMessage(
        "No se pudo conectar con el servicio de multimedia."
      );
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <section
      className={styles.editor}
      aria-labelledby="site-logo-editor-title"
      aria-busy={uploading}
    >
      <input
        type="hidden"
        name="logoAsset"
        value={asset}
      />
      <input
        type="hidden"
        name="logoColorMode"
        value={colorMode}
      />
      <input
        type="hidden"
        name="logoCustomColor"
        value={customColor}
      />

      <div className={styles.heading}>
        <span>LOGO GLOBAL</span>
        <h2 id="site-logo-editor-title">
          Símbolo de la marca
        </h2>
        <p>
          Este símbolo es único para toda la plataforma. Al publicar se reutiliza en navegación, pie, Mi DeUna y panel administrativo.
        </p>
      </div>

      <div className={styles.layout}>
        <div className={styles.visualColumn}>
          <div
            className={styles.logoStage}
            style={{ "--logo-preview-color": logoColor } as CSSProperties}
          >
            <span className={styles.logoTile}>
              <SiteLogoMark
                size={58}
                strokeWidth={1.9}
                asset={asset || null}
                color={logoColor}
              />
            </span>
            <div>
              <strong>
                {asset ? "Logo personalizado" : "Símbolo original de DeUna"}
              </strong>
              <small>
                El encuadre se adapta sin deformar el archivo.
              </small>
            </div>
          </div>

          <input
            ref={inputRef}
            className={styles.fileInput}
            type="file"
            accept=".svg,image/svg+xml"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void uploadLogo(file);
            }}
          />

          <div className={styles.logoActions}>
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus size={17} aria-hidden="true" />
              {uploading ? "Validando…" : asset ? "Cambiar SVG" : "Subir SVG"}
            </button>
            {asset && (
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={uploading}
                onClick={() => {
                  setAsset("");
                  setMessage(
                    "Se restaurará el símbolo original cuando guardes el borrador."
                  );
                }}
              >
                <RotateCcw size={16} aria-hidden="true" />
                Usar original
              </button>
            )}
          </div>

          <p className={styles.fileHint}>
            SVG monocromático, máximo 256 KB. Se rechazan scripts, enlaces, estilos, recursos externos y cualquier estructura no admitida.
          </p>
        </div>

        <fieldset className={styles.colorPanel}>
          <legend>
            <Palette size={17} aria-hidden="true" />
            Color del logo
          </legend>

          <div className={styles.modeOption}>
            <input
              id="site-logo-color-brand"
              type="radio"
              name="logo-color-mode-ui"
              checked={colorMode === "brand"}
              onChange={() => setColorMode("brand")}
            />
            <label htmlFor="site-logo-color-brand">
              <strong>Seguir color de marca</strong>
              <small>
                Recomendado. Si cambias la marca, el logo cambia con ella.
              </small>
            </label>
            <i style={{ background: brandColor }} aria-hidden="true" />
          </div>

          <div className={styles.modeOption}>
            <input
              id="site-logo-color-custom"
              type="radio"
              name="logo-color-mode-ui"
              checked={colorMode === "custom"}
              onChange={() => setColorMode("custom")}
            />
            <label htmlFor="site-logo-color-custom">
              <strong>Color personalizado</strong>
              <small>
                Mantiene el logo independiente del color principal del sitio.
              </small>
            </label>
            <input
              className={styles.colorInput}
              type="color"
              value={customColor}
              disabled={colorMode !== "custom"}
              aria-label="Color personalizado del logo"
              onChange={(event) =>
                setCustomColor(event.target.value)
              }
            />
          </div>

          <div className={styles.securityNote}>
            <ShieldCheck size={17} aria-hidden="true" />
            <span>
              El archivo se guarda como recurso editorial inmutable. Subirlo no publica ni modifica el sitio hasta guardar y publicar la identidad.
            </span>
          </div>
        </fieldset>
      </div>

      {message && (
        <p className={styles.status} role="status">
          {message}
        </p>
      )}
    </section>
  );
}
