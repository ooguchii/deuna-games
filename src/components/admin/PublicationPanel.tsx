import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Send,
} from "lucide-react";

import type {
  GamePublicationState,
} from "@/lib/admin/publication-service";

import styles from "./PublicationPanel.module.css";

type PublicationPanelProps = {
  slug: string;
  state: GamePublicationState;
  requestState?: string;
};

const actionLabels = {
  bootstrap: "Snapshot inicial",
  published: "Publicación",
  rollback: "Restauración",
} as const;

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(value);
}

function StateNotice({
  state,
}: {
  state?: string;
}) {
  if (!state) return null;

  if (state === "publicado") {
    return (
      <div className={`${styles.notice} ${styles.noticeSuccess}`}>
        El borrador fue publicado correctamente y ya es el snapshot activo.
      </div>
    );
  }

  if (state === "publicacion-restaurada") {
    return (
      <div className={`${styles.notice} ${styles.noticeSuccess}`}>
        La publicación histórica fue restaurada como una nueva publicación activa.
      </div>
    );
  }

  if (state === "sin-cambios") {
    return (
      <div className={styles.notice}>
        No se realizaron cambios porque el contenido seleccionado ya coincide con la publicación activa.
      </div>
    );
  }

  if (
    state === "conflicto" ||
    state === "conflicto-publicacion"
  ) {
    return (
      <div className={`${styles.notice} ${styles.noticeWarning}`}>
        El contenido cambió mientras se procesaba la operación. La página se actualizó sin sobrescribir cambios más recientes.
      </div>
    );
  }

  if (state === "solicitud" || state === "datos") {
    return (
      <div className={`${styles.notice} ${styles.noticeError}`}>
        La solicitud de publicación fue rechazada porque no superó la validación administrativa.
      </div>
    );
  }

  return null;
}

export default function PublicationPanel({
  slug,
  state,
  requestState,
}: PublicationPanelProps) {
  const current = state.publications.find(
    (publication) =>
      publication.publicationNumber ===
      state.publicationNumber
  );

  return (
    <div className={styles.panel}>
      <StateNotice state={requestState} />

      <div className={styles.summary}>
        <strong>
          {state.hasUnpublishedChanges
            ? "Hay cambios listos para publicar."
            : "El borrador coincide con la publicación activa."}
        </strong>
        <p>
          Publicar crea un snapshot separado del borrador. Restaurar una versión anterior crea otra publicación nueva y conserva todo el historial.
        </p>
      </div>

      <div className={styles.facts}>
        <div className={styles.fact}>
          <span>Publicación activa</span>
          <strong>#{state.publicationNumber}</strong>
        </div>
        <div className={styles.fact}>
          <span>Revisión de origen</span>
          <strong>
            {state.publishedFromRevision
              ? `#${state.publishedFromRevision}`
              : "Snapshot inicial"}
          </strong>
        </div>
        <div className={styles.fact}>
          <span>Publicada</span>
          <strong>{formatDate(state.publishedAt)} UTC</strong>
        </div>
      </div>

      <form
        method="post"
        action={`/api/admin/content/games/${encodeURIComponent(slug)}/publish`}
        className={styles.publishForm}
      >
        <input
          type="hidden"
          name="expectedRevision"
          value={state.draftRevision}
        />
        <button
          type="submit"
          className={styles.publishButton}
          disabled={!state.hasUnpublishedChanges}
        >
          <Send size={16} aria-hidden="true" />
          Publicar borrador
        </button>
        <span className={styles.statusText}>
          {state.hasUnpublishedChanges ? (
            <AlertTriangle size={15} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={15} aria-hidden="true" />
          )}
          Revisión {state.draftRevision}
        </span>
      </form>

      <div className={styles.history}>
        <div className={styles.historyHeading}>
          <div>
            <strong>Historial de publicaciones</strong>
            <span>Últimas {state.publications.length} versiones conservadas</span>
          </div>
          {current && (
            <span className={styles.historyMeta}>
              checksum {current.checksum.slice(0, 10)}…
            </span>
          )}
        </div>

        <div className={styles.historyList}>
          {state.publications.map((publication) => {
            const isCurrent =
              publication.publicationNumber ===
              state.publicationNumber;

            return (
              <div
                key={publication.id}
                className={styles.historyRow}
              >
                <div className={styles.historyCopy}>
                  <div className={styles.historyTitle}>
                    <strong>
                      #{publication.publicationNumber} · {actionLabels[publication.action]}
                    </strong>
                    {isCurrent && (
                      <span className={styles.currentBadge}>
                        Activa
                      </span>
                    )}
                  </div>
                  <span className={styles.historyMeta}>
                    {formatDate(publication.createdAt)} UTC
                    {publication.sourceRevision
                      ? ` · revisión ${publication.sourceRevision}`
                      : " · origen inicial"}
                    {` · ${publication.checksum.slice(0, 10)}…`}
                  </span>
                </div>

                <form
                  method="post"
                  action={`/api/admin/content/publications/${publication.id}/restore`}
                >
                  <input
                    type="hidden"
                    name="expectedPublicationNumber"
                    value={state.publicationNumber}
                  />
                  <button
                    type="submit"
                    className={styles.restoreButton}
                    disabled={isCurrent}
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                    {isCurrent
                      ? "Versión activa"
                      : "Restaurar"}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
