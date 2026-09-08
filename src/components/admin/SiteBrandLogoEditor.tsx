"use client";

import {
  ImagePlus,
  Palette,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import {
  type CSSProperties,
  useEffect,
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
  initialScale: number;
  brandColor: string;
  initialColorMode: SiteLogoColorMode;
  initialCustomColor: string;
};

type UploadPayload = {
  publicPath?: string;
  format?: "svg" | "png" | "jpg" | "webp" | "gif";
  error?: string;
};

export default function SiteBrandLogoEditor({
  revision,
  initialAsset,
  initialScale,
  brandColor,
  initialColorMode,
  initialCustomColor,
}: SiteBrandLogoEditorProps) {
  const editorRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scale, setScale] = useState(initialScale);
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

  useEffect(() => {
    if (!uploading) return;

    const form = editorRef.current?.closest("form");
    if (!form) return;

    const submitControls = Array.from(
      form.querySelectorAll<
        HTMLButtonElement | HTMLInputElement
      >('button[type="submit"], input[type="submit"]')
    );
    const disabledBeforeUpload = submitControls.map(
      (control) => control.disabled
    );
    const blockSubmit = (event: SubmitEvent) => {
      event.preventDefault();
      setMessage(
        "Espera a que termine la validación del logo antes de guardar el borrador."
      );
    };

    submitControls.forEach((control) => {
      control.disabled = true;
    });
    form.addEventListener("submit", blockSubmit);

    return () => {
      form.removeEventListener("submit", blockSubmit);
      submitControls.forEach((control, index) => {
        control.disabled = disabledBeforeUpload[index] ?? false;
      });
    };
  }, [uploading]);

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
      setColorMode("original");
      setMessage(
        "Logo validado y saneado. Se eliminó metadata del archivo y no se conserva su nombre original; guarda el borrador para incorporarlo a la identidad."
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
      ref={editorRef}
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
                scale={scale}
                strokeWidth={1.9}
                asset={asset || null}
                color={logoColor}
                colorMode={colorMode}
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
            hidden
            accept=".svg,.png,.jpg,.jpeg,.webp,.gif,image/svg+xml,image/png,image/jpeg,image/webp,image/gif"
            aria-label="Archivo de imagen del logo"
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
              {uploading ? "Validando…" : asset ? "Cambiar logo" : "Subir logo"}
            </button>
            {asset && (
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={uploading}
                onClick={() => {
                  setAsset("");
                  setColorMode("brand");
                  setMessage(
                    "Se restaurará el símbolo de DeUna cuando guardes el borrador."
                  );
                }}
              >
                <RotateCcw size={16} aria-hidden="true" />
                Restaurar símbolo DeUna
              </button>
            )}
          </div>

          <label className={styles.sizeControl} htmlFor="site-logo-scale">
            <span>Tamaño del logo: {scale}%</span>
            <input
              id="site-logo-scale"
              name="logoScale"
              type="range"
              min={50}
              max={200}
              step={1}
              value={scale}
              aria-valuetext={`${scale}%`}
              onChange={(event) => setScale(Number(event.target.value))}
            />
            <small>De 50% a 200%. Se aplica en toda la plataforma al guardar y publicar.</small>
          </label>
          <div className={styles.logoActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setScale(100)}>
              Restablecer tamaño
            </button>
          </div>

          <p className={styles.fileHint}>
            SVG estático de hasta 256 KB o PNG, JPEG, WebP y GIF estático de hasta 6 MB. El formato se detecta por contenido, no por extensión. Antes de guardar se eliminan metadata, perfiles ICC, EXIF/XMP, comentarios y bloques auxiliares; no se persiste el nombre original del archivo.
          </p>
        </div>

        <fieldset className={styles.colorPanel}>
          <legend>
            <Palette size={17} aria-hidden="true" />
            Color del logo
          </legend>

          <div className={styles.modeOption}>
            <span className={styles.radioTarget}>
              <input
                className={styles.radioInput}
                id="site-logo-color-original"
                type="radio"
                name="logoColorMode"
                value="original"
                checked={colorMode === "original"}
                onChange={() => setColorMode("original")}
              />
              <span className={styles.radioMark} aria-hidden="true" />
            </span>
            <label htmlFor="site-logo-color-original">
              <strong>Colores originales del archivo</strong>
              <small>
                Conserva los colores del SVG o de la imagen raster saneada tal como se ven en el archivo.
              </small>
            </label>
            <i aria-hidden="true" />
          </div>

          <div className={styles.modeOption}>
            <span className={styles.radioTarget}>
              <input
                className={styles.radioInput}
                id="site-logo-color-brand"
                type="radio"
                name="logoColorMode"
                value="brand"
                checked={colorMode === "brand"}
                onChange={() => setColorMode("brand")}
              />
              <span className={styles.radioMark} aria-hidden="true" />
            </span>
            <label htmlFor="site-logo-color-brand">
              <strong>Seguir color de marca</strong>
              <small>
                Si cambias la marca, el logo cambia con ella.
              </small>
            </label>
            <i style={{ background: brandColor }} aria-hidden="true" />
          </div>

          <div className={styles.modeOption}>
            <span className={styles.radioTarget}>
              <input
                className={styles.radioInput}
                id="site-logo-color-custom"
                type="radio"
                name="logoColorMode"
                value="custom"
                checked={colorMode === "custom"}
                onChange={() => setColorMode("custom")}
              />
              <span className={styles.radioMark} aria-hidden="true" />
            </span>
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
              El archivo se sanea como recurso estático e inmutable y se vuelve a validar cada vez que se lee o sirve. Subirlo no publica ni modifica el sitio hasta guardar y publicar la identidad.
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
