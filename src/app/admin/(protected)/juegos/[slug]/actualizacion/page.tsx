import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { notFound } from "next/navigation";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import EditorStateNotice from "@/components/admin/EditorStateNotice";
import GameDownloadEditor from "@/components/admin/GameDownloadEditor";
import {
  getEditorialItem,
  listEditorialItems,
} from "@/lib/admin/content-service";
import {
  getGamePublicationIdentity,
} from "@/lib/admin/publication-overview";
import {
  evaluateGamePublicationReadiness,
} from "@/lib/admin/game-publication-readiness";
import {
  verifyAdminSession,
} from "@/lib/admin/session";
import {
  getPublicGameBySlug,
} from "@/lib/games/public-catalog";
import type {
  GameDownloadSource,
} from "@/types/game";

import styles from "../../../../admin.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    estado?: string | string[];
  }>;
};

const channelLabels = {
  stable: "Estable",
  beta: "Beta",
  testing: "Pruebas",
} as const;

function legacySource(
  href: string,
  label: string | undefined
): GameDownloadSource {
  return {
    id: "primary",
    name: "Descarga principal",
    href,
    label: label?.trim() || "Descargar versión actual",
    enabled: true,
    status: "available",
  };
}

export default async function AdminGameUpdatePage({
  params,
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [{ slug }, parameters] = await Promise.all([
    params,
    searchParams,
  ]);
  const [
    item,
    publicationIdentity,
    publicGame,
    allUpdates,
  ] = await Promise.all([
    getEditorialItem("game", slug),
    getGamePublicationIdentity(slug),
    getPublicGameBySlug(slug),
    listEditorialItems("game_update"),
  ]);

  if (!item) notFound();

  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;
  const game = item.payload;
  const publicBaseline = publicGame ?? game;
  const download = publicBaseline.download;
  const currentDistribution = publicBaseline.distributionMetadata;
  const initialSources = download?.sources?.length
    ? download.sources
    : download?.href
      ? [legacySource(download.href, download.label)]
      : [];
  const relatedUpdates = allUpdates
    .filter((update) => update.payload.gameSlug === slug)
    .sort(
      (a, b) =>
        Date.parse(b.payload.publishedAt) -
        Date.parse(a.payload.publishedAt)
    )
    .slice(0, 8);
  const readiness =
    evaluateGamePublicationReadiness(game);
  const canPublish = Boolean(
    publicationIdentity?.publicVisible &&
      !publicationIdentity.hasUnpublishedChanges &&
      readiness.essentialsReady
  );
  const updateAction =
    `/api/admin/content/games/${encodeURIComponent(slug)}/publish-update`;

  return (
    <>
      <Link
        href={`/admin/juegos/${encodeURIComponent(slug)}?seccion=descargas`}
        className={styles.backLink}
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Volver a Distribución
      </Link>

      <AdminPageHeader
        eyebrow={<>DISTRIBUCIÓN · NUEVA VERSIÓN · REVISIÓN {item.revision}</>}
        title={game.title}
        description="Publica una nueva versión sin cambiar la URL del juego. La operación reemplaza descargas e integridad del paquete y crea el aviso público en un solo paso."
        action={
          <Link
            href={`/juegos/${encodeURIComponent(slug)}`}
            className={styles.tableAction}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={14} aria-hidden="true" />
            Ver juego público
          </Link>
        }
      />

      <EditorStateNotice state={state} />

      {!publicationIdentity?.publicVisible && (
        <div
          className={`${styles.editorNotice} ${styles.editorNoticeWarning}`}
          role="status"
        >
          <ShieldCheck size={18} aria-hidden="true" />
          <span>
            Este juego todavía no está visible públicamente. Completa su primera publicación antes de publicar una nueva versión.
          </span>
        </div>
      )}

      {publicationIdentity?.publicVisible &&
        publicationIdentity.hasUnpublishedChanges && (
          <div
            className={`${styles.editorNotice} ${styles.editorNoticeWarning}`}
            role="status"
          >
            <ShieldCheck size={18} aria-hidden="true" />
            <span>
              Hay otros cambios pendientes en el borrador de este juego. Por seguridad, DeUna no los publicará accidentalmente junto con una nueva versión. Publica o restaura esos cambios antes de continuar. Los datos mostrados abajo corresponden a la versión realmente visible en la web.
            </span>
          </div>
        )}

      {publicationIdentity?.publicVisible &&
        !publicationIdentity.hasUnpublishedChanges &&
        !readiness.essentialsReady && (
          <div
            className={`${styles.editorNotice} ${styles.editorNoticeWarning}`}
            role="status"
          >
            <ShieldCheck size={18} aria-hidden="true" />
            <span>
              La publicación actual es anterior a los controles multimedia obligatorios. Confirma Portada, Hero, Card y Galería desde Multimedia antes de publicar una nueva versión.
            </span>
          </div>
        )}

      <section className={styles.editorPanel}>
        <div className={styles.sectionHeading}>
          <div>
            <span>ESTADO ACTUAL</span>
            <h2>Versión pública y descargas</h2>
          </div>
          <p>
            La dirección pública permanece siempre en /juegos/{slug}. Cada versión conserva su paquete, canal y checksum dentro del snapshot publicado.
          </p>
        </div>

        <div className={styles.tableSummary}>
          <strong>Versión pública actual</strong>
          <span>
            {publicBaseline.version?.trim() || "Sin versión registrada"}
          </span>
        </div>
        <div className={styles.tableSummary}>
          <strong>Fuentes públicas configuradas</strong>
          <span>{initialSources.length}</span>
        </div>
        <div className={styles.tableSummary}>
          <strong>Canal actual</strong>
          <span>
            {currentDistribution?.channel
              ? channelLabels[currentDistribution.channel]
              : "Sin definir"}
          </span>
        </div>
        <div className={styles.tableSummary}>
          <strong>SHA-256 actual</strong>
          <span>
            {currentDistribution?.checksumSha256
              ? `${currentDistribution.checksumSha256.slice(0, 12)}…${currentDistribution.checksumSha256.slice(-12)}`
              : "Sin checksum"}
          </span>
        </div>
        <div className={styles.tableSummary}>
          <strong>URL estable</strong>
          <span>/juegos/{slug}</span>
        </div>
      </section>

      <section className={styles.editorPanel}>
        <div className={styles.sectionHeading}>
          <div>
            <span>NUEVA VERSIÓN</span>
            <h2>Publicar nueva versión</h2>
          </div>
          <p>
            La confirmación publica inmediatamente el juego actualizado y su aviso. El checksum anterior nunca se hereda: cada paquete nuevo debe declararlo otra vez o dejarlo explícitamente sin definir.
          </p>
        </div>

        <form
          className={styles.editorForm}
          method="post"
          action={updateAction}
        >
          <input
            type="hidden"
            name="expectedRevision"
            value={item.revision}
          />

          <fieldset
            disabled={!canPublish}
            className={styles.fieldWide}
            style={{
              border: 0,
              padding: 0,
              margin: 0,
              display: "contents",
            }}
          >
            <label>
              <span>Nueva versión</span>
              <input
                name="version"
                maxLength={80}
                placeholder="Ej. v1.11.0"
                autoComplete="off"
                required
              />
              <small>
                Debe ser distinta de la versión actualmente publicada.
              </small>
            </label>

            <label>
              <span>Tipo de aviso</span>
              <select name="type" defaultValue="update" required>
                <option value="update">Actualización</option>
                <option value="content">Nuevo contenido</option>
                <option value="fix">Corrección</option>
                <option value="improvement">Mejora</option>
              </select>
            </label>

            <label>
              <span>Destacar en Actualizaciones</span>
              <select name="featured" defaultValue="false" required>
                <option value="false">No</option>
                <option value="true">Sí</option>
              </select>
            </label>

            <label>
              <span>Plataforma / paquete</span>
              <input
                name="platform"
                defaultValue={download?.platform ?? game.platforms?.[0] ?? ""}
                maxLength={80}
                placeholder="A confirmar"
              />
            </label>

            <label>
              <span>Tamaño total (GB)</span>
              <input
                name="sizeGb"
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
                defaultValue={download?.sizeGb ?? ""}
              />
            </label>

            <label>
              <span>Cantidad de archivos</span>
              <input
                name="fileCount"
                type="number"
                min="1"
                max="10000"
                step="1"
                defaultValue={download?.fileCount ?? ""}
              />
            </label>

            <label>
              <span>Canal de la nueva versión</span>
              <select name="channel" defaultValue="">
                <option value="">Sin definir</option>
                <option value="stable">Estable</option>
                <option value="beta">Beta</option>
                <option value="testing">Pruebas</option>
              </select>
              <small>
                Se decide para esta versión; no se copia automáticamente del paquete anterior.
              </small>
            </label>

            <label className={styles.fieldWide}>
              <span>SHA-256 del nuevo paquete</span>
              <input
                name="checksumSha256"
                minLength={64}
                maxLength={64}
                autoComplete="off"
                spellCheck={false}
                placeholder="64 caracteres hexadecimales"
              />
              <small>
                Calcula el SHA-256 del paquete final. Todas las fuentes de esta versión deben entregar esos mismos bytes.
              </small>
            </label>

            <label className={styles.fieldWide}>
              <span>Resumen público</span>
              <textarea
                name="summary"
                maxLength={1500}
                rows={5}
                placeholder="Describe brevemente qué cambió en esta versión."
                required
              />
              <small>
                Este texto aparece en /actualizaciones y en el historial de versiones de la ficha del juego.
              </small>
            </label>

            <div className={styles.fieldWide}>
              <GameDownloadEditor
                initialSources={initialSources}
              />
            </div>

            <div className={styles.formActions}>
              <p>
                Se requiere al menos una fuente disponible. Al confirmar, DeUna actualiza versión + descargas + integridad del paquete + publicación del juego + aviso público dentro de la misma transacción editorial.
              </p>
              <button type="submit">
                <RefreshCcw size={15} aria-hidden="true" />
                Publicar nueva versión
              </button>
            </div>
          </fieldset>
        </form>
      </section>

      <section className={styles.editorPanel}>
        <div className={styles.sectionHeading}>
          <div>
            <span>HISTORIAL</span>
            <h2>Versiones registradas para este juego</h2>
          </div>
          <p>
            El historial se conserva aunque las fuentes de descarga sigan cambiando con versiones posteriores.
          </p>
        </div>

        {relatedUpdates.length > 0 ? (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Versión</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Estado editorial</th>
                </tr>
              </thead>
              <tbody>
                {relatedUpdates.map((update) => (
                  <tr key={update.key}>
                    <th scope="row">
                      <strong>{update.payload.version}</strong>
                      <span>{update.key}</span>
                    </th>
                    <td>{update.payload.type}</td>
                    <td>
                      {new Date(
                        update.payload.publishedAt
                      ).toLocaleDateString("es")}
                    </td>
                    <td>
                      {update.status === "synced"
                        ? "Sin cambios"
                        : "Registrada"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.emptyState}>
            Todavía no hay versiones registradas para este juego.
          </p>
        )}
      </section>
    </>
  );
}
