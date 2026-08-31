import { notFound } from "next/navigation";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import EditorialHistory from "@/components/admin/EditorialHistory";
import EditorStateNotice from "@/components/admin/EditorStateNotice";
import HomeCurationEditor from "@/components/admin/HomeCurationEditor";
import HomePresentationEditor from "@/components/admin/HomePresentationEditor";
import PublicationPanel from "@/components/admin/PublicationPanel";
import {
  resolveHomeConfig,
} from "@/data/home-config";
import {
  getEditorialItem,
  listEditorialItems,
} from "@/lib/admin/content-service";
import {
  listPublicationStates,
} from "@/lib/admin/publication-overview";
import {
  getHomeConfigPublicationState,
} from "@/lib/admin/publication-service";
import {
  verifyAdminSession,
} from "@/lib/admin/session";
import {
  getPublicGames,
} from "@/lib/games/public-catalog";

import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

const sections = [
  "curaduria",
  "presentacion",
  "publicacion",
  "historial",
] as const;

type HomeAdminSection = (typeof sections)[number];

type PageProps = {
  searchParams: Promise<{
    estado?: string | string[];
    seccion?: string | string[];
  }>;
};

function resolveSection(
  value: string | string[] | undefined
): HomeAdminSection {
  const candidate = Array.isArray(value)
    ? value[0]
    : value;

  return sections.includes(candidate as HomeAdminSection)
    ? (candidate as HomeAdminSection)
    : "curaduria";
}

export default async function AdminHomeEditorPage({
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [
    item,
    games,
    publicGames,
    gamePublicationStates,
    parameters,
  ] = await Promise.all([
    getEditorialItem("home_config", "home"),
    listEditorialItems("game"),
    getPublicGames(),
    listPublicationStates("game"),
    searchParams,
  ]);

  if (!item) notFound();

  let publicationState = null;

  try {
    publicationState =
      await getHomeConfigPublicationState();
  } catch {
    console.error(
      "No se pudo leer el estado de publicación de la portada."
    );
  }

  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;
  const section = resolveSection(parameters.seccion);
  const resolved = resolveHomeConfig(item.payload);
  const publishedSlugs =
    gamePublicationStates === null
      ? null
      : gamePublicationStates
          .filter((game) => game.publicVisible)
          .map((game) => game.key);
  const publicBySlug = new Map(
    publicGames.map((game) => [game.slug, game])
  );
  const curationGames = games.map((game) =>
    publicBySlug.get(game.key) ?? game.payload
  );

  return (
    <>
      <AdminPageHeader
        eyebrow={<>PORTADA · REVISIÓN {item.revision}</>}
        title="Inicio"
        description="Administra curaduría, automatización, orden, visibilidad y textos de Inicio sin mezclar contenido con la lógica de los componentes. Todo queda en borrador hasta publicar."
        action={<span className={styles.draftState}>
          {publicationState?.hasUnpublishedChanges
            ? "Cambios sin publicar"
            : item.status === "synced"
              ? "Sin cambios"
              : "Borrador guardado"}
        </span>}
      />

      <EditorStateNotice state={state} />

      {section === "curaduria" && (
        <HomeCurationEditor
          config={resolved}
          games={curationGames}
          publishedSlugs={publishedSlugs}
          revision={item.revision}
        />
      )}

      {section === "presentacion" && (
        <HomePresentationEditor
          config={resolved}
          revision={item.revision}
        />
      )}

      {section === "publicacion" && (
        <section className={styles.editorPanel}>
          {publicationState ? (
            <PublicationPanel
              state={publicationState}
              requestState={state}
              publishAction="/api/admin/content/home/publish"
              restoreActionBase="/api/admin/content/home-publications"
            />
          ) : (
            <p>
              La infraestructura de publicación todavía no está disponible en esta base. Aplica las migraciones e importa el contenido editorial antes de publicar la portada.
            </p>
          )}
        </section>
      )}

      {section === "historial" && (
        <EditorialHistory
          revisions={item.revisions}
          currentRevision={item.revision}
        />
      )}
    </>
  );
}
