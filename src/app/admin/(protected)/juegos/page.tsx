import Link from "next/link";
import { Plus } from "lucide-react";

import AdminGamesCatalog, {
  type AdminGameCatalogItem,
} from "@/components/admin/AdminGamesCatalog";
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

export default async function AdminGamesPage({
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [items, publicationStates, parameters] =
    await Promise.all([
      listEditorialItems("game"),
      listPublicationStates("game"),
      searchParams,
    ]);
  const publicationByKey = new Map(
    (publicationStates ?? []).map((item) => [item.key, item])
  );
  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;

  const catalog: AdminGameCatalogItem[] = items.map((item) => {
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
    const status: AdminGameCatalogItem["status"] = hidden
      ? neverPublished
        ? "unpublished"
        : "hidden"
      : pending
        ? "pending"
        : "published";

    return {
      key: item.key,
      title: item.payload.title,
      category: item.payload.category,
      version: item.payload.version ?? null,
      revision: item.revision,
      publicationNumber: neverPublished
        ? null
        : publication?.publicationNumber ?? null,
      status,
      searchText: [
        item.payload.title,
        item.key,
        item.payload.category,
        item.payload.version,
        item.payload.developer,
        item.payload.publisher,
        ...(item.payload.genres ?? []),
        ...(item.payload.tags ?? []),
        ...(item.payload.platforms ?? []),
      ]
        .filter(Boolean)
        .join(" "),
    };
  });

  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span>CATÁLOGO EDITORIAL</span>
          <h1>Juegos</h1>
          <p>
            Busca, filtra y entra directamente al contenido que necesitas. Guardar conserva borrador; Publicar crea el snapshot visible.
          </p>
        </div>
        <Link href="/admin/juegos/nuevo" className={styles.tableAction}>
          <Plus size={15} aria-hidden="true" />
          Nuevo juego
        </Link>
      </header>

      <EditorStateNotice state={state} />

      {items.length === 0 ? (
        <p className={styles.emptyState}>
          Importa el catálogo fuente o crea un juego nuevo como borrador privado.
        </p>
      ) : (
        <AdminGamesCatalog items={catalog} />
      )}
    </>
  );
}
