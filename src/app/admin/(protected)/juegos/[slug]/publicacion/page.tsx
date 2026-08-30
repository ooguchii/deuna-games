import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { notFound } from "next/navigation";

import GamePublicationWorkspace from "@/components/admin/GamePublicationWorkspace";
import {
  getEditorialItem,
} from "@/lib/admin/content-service";
import {
  getGamePublicationState,
} from "@/lib/admin/publication-service";
import {
  verifyAdminSession,
} from "@/lib/admin/session";

import styles from "../../../../admin.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    estado?: string | string[];
  }>;
};

export default async function AdminGamePublicationPage({
  params,
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [{ slug }, parameters] = await Promise.all([
    params,
    searchParams,
  ]);
  const item = await getEditorialItem("game", slug);

  if (!item) notFound();

  const publicationState =
    await getGamePublicationState(slug);

  if (!publicationState) notFound();

  const requestState = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;
  const panelCreated = Boolean(
    !item.sourcePresent &&
      item.revisions.some(
        (revision) =>
          revision.revision === 1 &&
          revision.action === "draft_saved"
      )
  );
  const neverPublished = Boolean(
    panelCreated &&
      !publicationState.publicVisible &&
      publicationState.publications.every(
        (publication) =>
          publication.action === "bootstrap"
      )
  );

  return (
    <>
      <Link
        href="/admin/juegos"
        className={styles.backLink}
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Volver a juegos
      </Link>

      <header className={styles.pageHeader}>
        <div>
          <span>PUBLICACIÓN · REVISIÓN {item.revision}</span>
          <h1>{item.payload.title}</h1>
          <p>
            Revisa el borrador, comprueba la preparación editorial y decide cuándo debe cambiar la web pública.
          </p>
        </div>

        <Link
          href={`/admin/juegos/${encodeURIComponent(slug)}/vista-previa`}
          className={styles.tableAction}
        >
          <Eye size={15} aria-hidden="true" />
          Vista previa
        </Link>
      </header>

      <GamePublicationWorkspace
        game={item.payload}
        slug={slug}
        state={publicationState}
        requestState={requestState}
        neverPublished={neverPublished}
        panelCreated={panelCreated}
      />
    </>
  );
}
