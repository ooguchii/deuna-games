"use client";

import Image from "next/image";
import {
  type FormEvent,
  useRef,
  useState,
} from "react";

import {
  createDefaultBackgroundSetting,
  getSiteBackgroundAssets,
  siteBackgroundPageOptions,
  type SiteBackgroundAsset,
  type SiteBackgroundMap,
  type SiteBackgroundPage,
  type SiteBackgroundSetting,
} from "@/lib/site/backgrounds";

import adminStyles from "../../app/admin/admin.module.css";
import styles from "./SiteBackgroundManager.module.css";

type SiteBackgroundManagerProps = {
  revision: number;
  brandColor: string;
  customAssets?: SiteBackgroundAsset[];
  pageBackgrounds?: SiteBackgroundMap;
};

const MAX_OUTPUT_BYTES = 6 * 1024 * 1024;
const MAX_SOURCE_BYTES = 24 * 1024 * 1024;
const MAX_SAFE_DIMENSION = 8_192;
const MAX_SAFE_PIXELS = 33_554_432;
const qualities = [0.94, 0.9, 0.84, 0.78, 0.7, 0.62, 0.54];
const acceptedTypes = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function encodeWebp(
  canvas: HTMLCanvasElement,
  quality: number
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("El navegador no pudo generar el WebP."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality
    );
  });
}

function safeInitialScale(width: number, height: number) {
  const dimensionScale =
    MAX_SAFE_DIMENSION / Math.max(width, height);
  const pixelScale = Math.sqrt(
    MAX_SAFE_PIXELS / (width * height)
  );

  return Math.min(1, dimensionScale, pixelScale);
}

async function normalizeBackground(file: File) {
  if (file.size <= 0 || file.size > MAX_SOURCE_BYTES) {
    throw new Error(
      "La imagen debe pesar como máximo 24 MB antes de prepararla."
    );
  }

  if (
    file.type &&
    !acceptedTypes.has(file.type.toLowerCase())
  ) {
    throw new Error("Usa una imagen PNG, JPEG, AVIF o WebP.");
  }

  let bitmap: ImageBitmap;

  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "La imagen no pudo decodificarse. Usa PNG, JPEG, AVIF o WebP válido."
    );
  }

  try {
    let scale = safeInitialScale(bitmap.width, bitmap.height);

    for (let attempt = 0; attempt < 7; attempt += 1) {
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: true });

      if (!context) {
        throw new Error(
          "El navegador no pudo preparar la imagen."
        );
      }

      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of qualities) {
        const blob = await encodeWebp(canvas, quality);

        if (blob.size <= MAX_OUTPUT_BYTES) {
          return {
            blob,
            width,
            height,
          };
        }
      }

      scale *= 0.82;
    }
  } finally {
    bitmap.close();
  }

  throw new Error(
    "No fue posible reducir la imagen por debajo de 6 MB de forma segura."
  );
}

function uploadError(state: string | null) {
  if (state === "conflicto") {
    return "Otra pestaña guardó una revisión más reciente. Recarga antes de volver a subir.";
  }
  if (state === "solicitud") {
    return "La carga fue rechazada por seguridad. Recarga el panel e inténtalo otra vez.";
  }
  if (state === "datos") {
    return "No se pudo agregar el fondo. Revisa el nombre o el límite de imágenes guardadas.";
  }
  return "El servidor no pudo guardar la imagen de fondo.";
}

export default function SiteBackgroundManager({
  revision,
  brandColor,
  customAssets = [],
  pageBackgrounds = {},
}: SiteBackgroundManagerProps) {
  const [page, setPage] = useState<SiteBackgroundPage>("home");
  const [drafts, setDrafts] = useState<
    Record<SiteBackgroundPage, SiteBackgroundSetting>
  >(() =>
    Object.fromEntries(
      siteBackgroundPageOptions.map(({ key }) => [
        key,
        pageBackgrounds[key] ??
          createDefaultBackgroundSetting(brandColor),
      ])
    ) as Record<SiteBackgroundPage, SiteBackgroundSetting>
  );
  const [uploadName, setUploadName] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const assets = getSiteBackgroundAssets(customAssets);
  const current = drafts[page];

  function updateCurrent(
    patch: Partial<SiteBackgroundSetting>
  ) {
    setDrafts((previous) => ({
      ...previous,
      [page]: {
        ...previous[page],
        ...patch,
      },
    }));
  }

  async function handleUpload(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (uploadBusy) return;

    const file = fileInput.current?.files?.[0];
    const name = uploadName.trim();

    if (!name) {
      setUploadStatus("Escribe un nombre para identificar el fondo.");
      return;
    }

    if (!file) {
      setUploadStatus("Selecciona una imagen para continuar.");
      return;
    }

    setUploadBusy(true);
    setUploadStatus("Preparando imagen…");

    try {
      const normalized = await normalizeBackground(file);
      const form = new FormData();
      form.set("expectedRevision", String(revision));
      form.set("name", name);
      form.set(
        "image",
        new File([normalized.blob], "site-background.webp", {
          type: "image/webp",
        })
      );

      setUploadStatus(
        `WebP listo: ${normalized.width}×${normalized.height}, ${(normalized.blob.size / 1024 / 1024).toFixed(2)} MB. Guardando borrador…`
      );

      const response = await fetch(
        "/api/admin/content/configuration/background-upload",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          body: form,
        }
      );

      if (!response.ok) {
        throw new Error("El servidor rechazó la carga multimedia.");
      }

      const resultUrl = new URL(response.url, window.location.href);
      const state = resultUrl.searchParams.get("estado");

      if (state !== "imagen-subida") {
        throw new Error(uploadError(state));
      }

      window.location.assign(resultUrl.toString());
    } catch (error) {
      setUploadStatus(
        error instanceof Error
          ? error.message
          : "No se pudo preparar la imagen."
      );
      setUploadBusy(false);
    }
  }

  return (
    <section className={`${adminStyles.editorPanel} ${styles.panel}`}>
      <div className={styles.heading}>
        <span>FONDOS DE PÁGINA</span>
        <h2>Imagen y color por sección</h2>
        <p>
          Cada página puede usar un fondo distinto. Los cambios quedan en borrador y sólo llegan al sitio al publicar la configuración.
        </p>
      </div>

      <div className={styles.managerGrid}>
        <form
          className={adminStyles.editorForm}
          method="post"
          action="/api/admin/content/configuration/background"
        >
          <input
            type="hidden"
            name="expectedRevision"
            value={revision}
          />

          <label className={adminStyles.fieldWide}>
            <span>Página</span>
            <select
              name="page"
              value={page}
              onChange={(event) =>
                setPage(event.target.value as SiteBackgroundPage)
              }
            >
              {siteBackgroundPageOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <fieldset className={`${styles.assetFieldset} ${adminStyles.fieldWide}`}>
            <legend>Imagen de fondo</legend>
            <div className={styles.assetGrid}>
              <label
                className={`${styles.assetCard} ${current.assetId === null ? styles.assetCardSelected : ""}`}
              >
                <input
                  type="radio"
                  name="assetId"
                  value=""
                  checked={current.assetId === null}
                  onChange={() => updateCurrent({ assetId: null })}
                />
                <span className={styles.noBackground}>Sin fondo</span>
                <strong>Color base del sitio</strong>
              </label>

              {assets.map((asset) => (
                <label
                  key={asset.id}
                  className={`${styles.assetCard} ${current.assetId === asset.id ? styles.assetCardSelected : ""}`}
                >
                  <input
                    type="radio"
                    name="assetId"
                    value={asset.id}
                    checked={current.assetId === asset.id}
                    onChange={() =>
                      updateCurrent({ assetId: asset.id })
                    }
                  />
                  <Image
                    src={asset.image}
                    alt=""
                    width={320}
                    height={180}
                    sizes="(max-width: 720px) 45vw, 220px"
                    unoptimized
                  />
                  <strong>{asset.name}</strong>
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            <span>Color aplicado sobre la imagen</span>
            <select
              name="colorMode"
              value={current.colorMode}
              onChange={(event) =>
                updateCurrent({
                  colorMode: event.target.value as "brand" | "custom",
                })
              }
            >
              <option value="brand">Color de marca ({brandColor})</option>
              <option value="custom">Color personalizado</option>
            </select>
          </label>

          <label>
            <span>Color personalizado</span>
            <input
              type="color"
              name="customColor"
              value={current.customColor}
              onChange={(event) =>
                updateCurrent({ customColor: event.target.value })
              }
              aria-label="Color personalizado del fondo"
            />
          </label>

          <label className={adminStyles.fieldWide}>
            <span>Intensidad del color — {current.tintOpacity}%</span>
            <input
              type="range"
              name="tintOpacity"
              min="0"
              max="100"
              step="1"
              value={current.tintOpacity}
              onChange={(event) =>
                updateCurrent({
                  tintOpacity: Number(event.target.value),
                })
              }
            />
            <small>
              La imagen mantiene un oscurecimiento fijo para que el contenido siga siendo legible.
            </small>
          </label>

          <div className={adminStyles.formActions}>
            <p>
              Guarda sólo el fondo de la página elegida. No modifica las demás secciones.
            </p>
            <button type="submit">Guardar fondo</button>
          </div>
        </form>

        <div className={styles.uploadPanel}>
          <h3>Agregar imagen</h3>
          <p>
            Puedes sumar fondos propios. Se convierten a WebP seguro y quedan disponibles para cualquiera de las páginas.
          </p>

          <form
            className={adminStyles.editorForm}
            method="post"
            encType="multipart/form-data"
            action="/api/admin/content/configuration/background-upload"
            onSubmit={handleUpload}
          >
            <input
              type="hidden"
              name="expectedRevision"
              value={revision}
            />

            <label className={adminStyles.fieldWide}>
              <span>Nombre del fondo</span>
              <input
                name="name"
                value={uploadName}
                onChange={(event) => setUploadName(event.target.value)}
                maxLength={80}
                placeholder="Ej. Ciudad nocturna"
                required
              />
            </label>

            <label className={adminStyles.fieldWide}>
              <span>Archivo</span>
              <input
                ref={fileInput}
                type="file"
                name="image"
                accept="image/avif,image/jpeg,image/png,image/webp,.avif,.jpg,.jpeg,.png,.webp"
                required
              />
              <small>PNG, JPEG, AVIF o WebP. Máximo 24 MB antes de convertir.</small>
            </label>

            {uploadStatus && (
              <div
                className={`${adminStyles.tableSummary} ${adminStyles.fieldWide}`}
                role="status"
                aria-live="polite"
              >
                <strong>Estado</strong>
                <span>{uploadStatus}</span>
              </div>
            )}

            <div className={adminStyles.formActions}>
              <p>
                La carga se guarda en el mismo borrador de Configuración y conserva el control de revisiones del panel.
              </p>
              <button type="submit" disabled={uploadBusy}>
                {uploadBusy ? "Preparando…" : "Agregar fondo"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
