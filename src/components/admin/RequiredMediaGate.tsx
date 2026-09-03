"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Crop,
  Images,
  LockKeyhole,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import styles from "./RequiredMediaGate.module.css";

type CropState = {
  target: "cover" | "hero" | "card";
  aspect: "4:5" | "16:9";
  resource: string | null;
  confirmed: boolean;
};

type Readiness = {
  crops: {
    cover: CropState;
    hero: CropState;
    card: CropState;
  };
  galleryReady: boolean;
  complete: boolean;
  pendingCount: number;
};

type ApiPayload = {
  readiness?: unknown;
};

function isCropState(value: unknown): value is CropState {
  if (!value || typeof value !== "object") return false;
  const crop = value as Partial<CropState>;
  return (
    (crop.target === "cover" || crop.target === "hero" || crop.target === "card") &&
    (crop.aspect === "4:5" || crop.aspect === "16:9") &&
    (typeof crop.resource === "string" || crop.resource === null) &&
    typeof crop.confirmed === "boolean"
  );
}

function parseReadiness(value: unknown): Readiness | null {
  if (!value || typeof value !== "object") return null;
  const root = value as {
    crops?: unknown;
    galleryReady?: unknown;
    complete?: unknown;
    pendingCount?: unknown;
  };
  if (!root.crops || typeof root.crops !== "object") return null;
  const crops = root.crops as Record<string, unknown>;
  if (
    !isCropState(crops.cover) ||
    !isCropState(crops.hero) ||
    !isCropState(crops.card) ||
    typeof root.galleryReady !== "boolean" ||
    typeof root.complete !== "boolean" ||
    typeof root.pendingCount !== "number"
  ) {
    return null;
  }

  return {
    crops: {
      cover: crops.cover,
      hero: crops.hero,
      card: crops.card,
    },
    galleryReady: root.galleryReady,
    complete: root.complete,
    pendingCount: root.pendingCount,
  };
}

function Requirement({
  label,
  detail,
  complete,
  gallery = false,
}: {
  label: string;
  detail: string;
  complete: boolean;
  gallery?: boolean;
}) {
  return (
    <article className={`${styles.requirement} ${complete ? styles.ready : styles.pending}`}>
      <span className={styles.requirementIcon}>
        {complete ? (
          <CheckCircle2 size={18} aria-hidden="true" />
        ) : gallery ? (
          <Images size={18} aria-hidden="true" />
        ) : (
          <Crop size={18} aria-hidden="true" />
        )}
      </span>
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
      <b>{complete ? "LISTO" : gallery ? "GALERÍA PENDIENTE" : "RECORTE PENDIENTE"}</b>
    </article>
  );
}

export default function RequiredMediaGate({ slug }: { slug: string }) {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(
      `/api/admin/content/games/${encodeURIComponent(slug)}/media-library`,
      {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      }
    )
      .then(async (response) => {
        const payload = await response.json() as ApiPayload;
        const parsed = parseReadiness(payload.readiness);
        if (!response.ok || !parsed) {
          throw new Error("Estado multimedia inválido.");
        }
        if (!cancelled) setReadiness(parsed);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <section className={styles.gate} aria-labelledby="required-media-heading">
      <div className={styles.heading}>
        <div>
          <span>MULTIMEDIA OBLIGATORIA</span>
          <h2 id="required-media-heading">Completa los destinos antes de continuar</h2>
        </div>
        <p>
          Cada destino principal exige su propio recorte confirmado. Cambiar el recurso asignado vuelve a dejar ese recorte pendiente.
        </p>
      </div>

      {error ? (
        <div className={styles.error} role="alert">
          No se pudo comprobar el estado multimedia. Recarga la página antes de continuar.
        </div>
      ) : !readiness ? (
        <div className={styles.loading} role="status">Comprobando requisitos multimedia…</div>
      ) : (
        <>
          <div className={styles.grid}>
            <Requirement
              label="Portada del juego · 4:5"
              detail={readiness.crops.cover.resource ? "Recurso asignado; confirma el encuadre de Portada." : "Primero asigna una imagen de Portada."}
              complete={readiness.crops.cover.confirmed}
            />
            <Requirement
              label="Hero de inicio · 16:9"
              detail={readiness.crops.hero.resource ? "Imagen o video asignado; confirma el encuadre de Hero." : "Asigna una imagen o video al Hero."}
              complete={readiness.crops.hero.confirmed}
            />
            <Requirement
              label="Card del juego · 4:5"
              detail={readiness.crops.card.resource ? "Confirma el recorte propio de Card aunque reutilice otro recurso." : "La Card necesita Portada o video asignado."}
              complete={readiness.crops.card.confirmed}
            />
            <Requirement
              label="Galería del juego · mínimo 1 imagen"
              detail="Debe existir al menos una captura asignada a la Galería."
              complete={readiness.galleryReady}
              gallery
            />
          </div>

          <div className={styles.footer}>
            <div>
              {readiness.complete ? (
                <CheckCircle2 size={18} aria-hidden="true" />
              ) : (
                <LockKeyhole size={18} aria-hidden="true" />
              )}
              <span>
                {readiness.complete
                  ? "Multimedia completa. Ya puedes avanzar a Descargas."
                  : `${readiness.pendingCount} requisito${readiness.pendingCount === 1 ? "" : "s"} pendiente${readiness.pendingCount === 1 ? "" : "s"}.`}
              </span>
            </div>

            {readiness.complete ? (
              <Link
                href={`/admin/juegos/${encodeURIComponent(slug)}?seccion=descargas`}
                className={styles.continueButton}
              >
                Continuar a Descargas
              </Link>
            ) : (
              <button type="button" className={styles.continueButton} disabled>
                Completa Multimedia para continuar
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}