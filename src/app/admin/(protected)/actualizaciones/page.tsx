import Link from "next/link";
import { Plus } from "lucide-react";

import AdminUpdatesCatalog, {
  type AdminUpdateCatalogItem,
} from "@/components/admin/AdminUpdatesCatalog";
import EditorStateNotice from "@/components/admin/EditorStateNotice";
import {
  listEditorialItems,
} from "@/lib/admin/content-service";
import {
  listPublicationStates,
} from "@/lib/admin/publication-overview";
import {
  verifyAdminSession,
} from "@/lib/admin/session";

import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    estado?: string | string[];
  }>;
};

export default async function AdminUpdatesPage({
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [items, publicationStates, parameters] =
    await Promise.all([
      listEditorialItems("game_update"),
      listPublicationStates("game_update"),
      searchParams,
    ]);
  const publicationByKey = new Map(
    (publicationStates ?? []).map((item) => [item.key, item])
  );
  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;

  const catalog: AdminUpdateCatalogItem[] = items.map((item) => {
    const publication = publicationByKey.get(item.key);
    const hidden = Boolean(publication && !publication.publicVisible);
    const neverPublished = Boolean(
      hidden &&
        !item.sourcePresent &&
        publication?.publicationNumber === 1
    );
    const pending = publication
      ? publication.hasUnpublishedChanges
      : item.status !== "synced";
    const status: AdminUpdateCatalogItem["status"] = hidden
      ? neverPublished
        ? "unpublished"
        : "hidden"
      : pending
        ? "pending"
        : "published";

    return {
      key: item.key,
      gameSlug: item.payload.gameSlug,
      version: item.payload.version,
      type: item.payload.type,
      revision: item.revision,
      publicationNumber: publication?.publicationNumber ?? null,
      status,
      searchText: [
        item.key,
        item.payload.gameSlug,
        item.payload.version,
        item.payload.type,
        item.payload.summary,
      ].join(" "),
    };
  });

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span>VERSIONES EDITORIALES</span>
          <h1>Actualizaciones</h1>
          <p>
            Encuentra rápidamente una versión por juego, ID, tipo o estado sin recorrer toda la lista.
          </p>
        </div>
        <Link
          href="/admin/actualizaciones/nueva"
          className={styles.tableAction}
        >
          <Plus size={15} aria-hidden="true" />
          Nueva actualización
        </Link>
      </header>

      <EditorStateNotice state={state} />

      {items.length === 0 ? (
        <p className={styles.emptyState}>
          Importa las actualizaciones fuente o crea una nueva como borrador privado.
        </p>
      ) : (
        <AdminUpdatesCatalog items={catalog} />
      )}
    </>
  );
}
