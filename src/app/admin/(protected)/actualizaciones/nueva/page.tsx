import Link from "next/link";
import {
  ArrowLeft,
  Plus,
} from "lucide-react";

import EditorStateNotice from "@/components/admin/EditorStateNotice";
import {
  listEditorialItems,
} from "@/lib/admin/content-service";
import {
  verifyAdminSession,
} from "@/lib/admin/session";

import styles from "../../../admin.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    estado?: string | string[];
  }>;
};

export default async function AdminNewUpdatePage({
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [games, parameters] = await Promise.all([
    listEditorialItems("game"),
    searchParams,
  ]);
  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;
  const nowUtc = new Date().toISOString().slice(0, 16);

  return (
    <>
      <Link
        href="/admin/actualizaciones"
        className={styles.backLink}
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Volver a actualizaciones
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <span>ALTA EDITORIAL</span>
          <h1>Nueva actualización</h1>
          <p>
            Crea una versión como borrador privado. No aparecerá en la web hasta que la revises y pulses Publicar.
          </p>
        </div>
        <span className={styles.draftState}>
          <Plus size={15} aria-hidden="true" />
          Borrador oculto
        </span>
      </header>

      <EditorStateNotice state={state} />

      <section className={styles.editorPanel}>
        <form
          className={styles.editorForm}
          method="post"
          action="/api/admin/content/updates"
        >
          <label>
            <span>Identificador</span>
            <input
              name="id"
              placeholder="juego-v1.2.0"
              minLength={1}
              maxLength={160}
              pattern="[a-z0-9][a-z0-9._-]*"
              autoComplete="off"
              required
            />
          </label>

          <label>
            <span>Juego relacionado</span>
            <select
              name="gameSlug"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Selecciona un juego
              </option>
              {games.map((game) => (
                <option
                  key={game.key}
                  value={game.key}
                >
                  {game.payload.title} · {game.key}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Versión</span>
            <input
              name="version"
              maxLength={80}
              placeholder="v1.2.0"
              autoComplete="off"
              required
            />
          </label>

          <label>
            <span>Fecha y hora UTC</span>
            <input
              name="publishedAt"
              type="datetime-local"
              defaultValue={nowUtc}
              required
            />
          </label>

          <label>
            <span>Tipo</span>
            <select
              name="type"
              defaultValue="update"
              required
            >
              <option value="update">Actualización</option>
              <option value="content">Contenido</option>
              <option value="fix">Corrección</option>
              <option value="improvement">Mejora</option>
            </select>
          </label>

          <label>
            <span>Destacada</span>
            <select
              name="featured"
              defaultValue="false"
              required
            >
              <option value="false">No</option>
              <option value="true">Sí</option>
            </select>
          </label>

          <label className={styles.fieldWide}>
            <span>Resumen</span>
            <textarea
              name="summary"
              maxLength={1500}
              rows={7}
              required
            />
          </label>

          <div className={styles.formActions}>
            <p>
              La actualización queda asociada al juego elegido y empieza oculta. Publicar es una operación posterior e independiente.
            </p>
            <button
              type="submit"
              disabled={games.length === 0}
            >
              Crear borrador
            </button>
          </div>
        </form>

        {games.length === 0 && (
          <p className={styles.emptyState}>
            Primero crea o importa al menos un juego editorial.
          </p>
        )}
      </section>
    </>
  );
}
