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
  const canPublish = Boolean(
    publicationIdentity?.publicVisible &&
      !publicationIdentity.hasUnpublishedChanges
  );
  const updateAction =
    `/api/admin/content/games/${encodeURIComponent(slug)}/publish-update`;

  return (
    <>
      <Link
        href={`/admin/juegos/${encodeURIComponent(slug)}`}
        className={styles.backLink}
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Volver a {game.title}
      </Link>

      <AdminPageHeader
        eyebrow={<>ACTUALIZAR JUEGO · REVISIÓN {item.revision}</>}
        title={game.title}
        description="Publica una nueva versión sin cambiar la URL del juego. Esta operación reemplaza las descargas actuales y crea el aviso público de actualización en un solo paso."
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
            Este juego todavía no está visible públicamente. Completa su primera publicación antes de generar avisos de actualización.
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
              Hay otros cambios pendientes en el borrador de este juego. Por seguridad, DeUna no los publicará accidentalmente junto con una actualización. Publica o restaura esos cambios antes de continuar. Los datos mostrados abajo corresponden a la versión que realmente está visible en la web.
            </span>
          </div>
        )}

      <section className={styles.editorPanel}>
        <div className={styles.sectionHeading}>
          <div>
            <span>ESTADO ACTUAL</span>
            <h2>Versión pública y descarga</h2>
          </div>
          <p>
            La dirección pública permanece siempre en /juegos/{slug}. Sólo cambian la versión, los enlaces de descarga y el historial de novedades.
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
          <strong>URL estable</strong>
          <span>/juegos/{slug}</span>
        </div>
      </section>

      <section className={styles.editorPanel}>
        <div className={styles.sectionHeading}>
          <div>
            <span>NUEVA VERSIÓN</span>
            <h2>Publicar actualización</h2>
          </div>
          <p>
            El botón final publica inmediatamente el juego actualizado y el aviso. No existe un segundo paso que pueda dejar ambos estados desincronizados.
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
                defaultValue={download?.platform ?? "PC"}
                maxLength={80}
                placeholder="PC"
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
                Se requiere al menos una fuente disponible. Al confirmar, DeUna actualiza versión + descargas + publicación del juego + aviso público dentro de la misma transacción editorial.
              </p>
              <button type="submit">
                <RefreshCcw size={15} aria-hidden="true" />
                Publicar actualización
              </button>
            </div>
          </fieldset>
        </form>
      </section>

      <section className={styles.editorPanel}>
        <div className={styles.sectionHeading}>
          <div>
            <span>HISTORIAL</span>
            <h2>Avisos registrados para este juego</h2>
          </div>
          <p>
            El historial se conserva aunque los enlaces de descarga del juego sigan cambiando con versiones posteriores.
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
            Todavía no hay actualizaciones registradas para este juego.
          </p>
        )}
      </section>
    </>
  );
}
