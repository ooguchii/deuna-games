import {
  BookOpenCheck,
} from "lucide-react";

import EditorStateNotice from "@/components/admin/EditorStateNotice";
import EditorialHistory from "@/components/admin/EditorialHistory";
import GameTaxonomyEditor from "@/components/admin/GameTaxonomyEditor";
import {
  getEditorialItem,
  listEditorialItems,
} from "@/lib/admin/content-service";
import {
  verifyAdminSession,
} from "@/lib/admin/session";
import type {
  GameTaxonomy,
  GameTaxonomyKind,
} from "@/types/game-taxonomy";

import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    estado?: string | string[];
  }>;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

function buildUsage(
  taxonomy: GameTaxonomy,
  games: Awaited<ReturnType<typeof listEditorialItems<"game">>>
) {
  const usage: Record<
    GameTaxonomyKind,
    Record<string, number>
  > = {
    classifications: {},
    tags: {},
  };

  const lookup = {
    classifications: new Map(
      taxonomy.classifications.map((term) => [
        normalize(term.label),
        term.key,
      ])
    ),
    tags: new Map(
      taxonomy.tags.map((term) => [normalize(term.label), term.key])
    ),
  };

  function count(
    kind: GameTaxonomyKind,
    value: string
  ) {
    const key = lookup[kind].get(normalize(value));
    if (!key) return;
    usage[kind][key] = (usage[kind][key] ?? 0) + 1;
  }

  for (const game of games) {
    const seenClassifications = new Set<string>();

    for (const value of [
      game.payload.category,
      ...(game.payload.genres ?? []),
    ]) {
      const normalized = normalize(value);
      if (!normalized || seenClassifications.has(normalized)) continue;
      seenClassifications.add(normalized);
      count("classifications", value);
    }

    for (const tag of game.payload.tags ?? []) {
      count("tags", tag);
    }
  }

  return usage;
}

export default async function AdminCatalogsPage({
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [item, games, parameters] = await Promise.all([
    getEditorialItem("game_taxonomy", "games"),
    listEditorialItems("game"),
    searchParams,
  ]);
  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span>DATOS MAESTROS</span>
          <h1>Catálogos</h1>
          <p>
            Administra una sola lista de clasificaciones para los juegos y una lista separada de etiquetas descriptivas. No existen categorías y géneros duplicados.
          </p>
        </div>
        <span className={styles.draftState}>
          <BookOpenCheck size={15} aria-hidden="true" />
          Privado · no publicable
        </span>
      </header>

      <EditorStateNotice state={state} />

      {!item ? (
        <section className={styles.editorPanel}>
          <h2>Catálogo administrativo pendiente</h2>
          <p>
            Ejecuta la actualización local para generar el catálogo inicial a partir de los juegos existentes.
          </p>
        </section>
      ) : (
        <>
          <GameTaxonomyEditor
            initialTaxonomy={item.payload}
            revision={item.revision}
            usage={buildUsage(item.payload, games)}
          />

          <EditorialHistory
            revisions={item.revisions}
            currentRevision={item.revision}
          />
        </>
      )}
    </>
  );
}
