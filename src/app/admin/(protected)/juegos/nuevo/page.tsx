import Link from "next/link";
import {
  ArrowLeft,
  Plus,
} from "lucide-react";

import EditorStateNotice from "@/components/admin/EditorStateNotice";
import NewGameForm from "@/components/admin/NewGameForm";
import {
  getEditorialItem,
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

export default async function AdminNewGamePage({
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [parameters, games, taxonomyItem] = await Promise.all([
    searchParams,
    listEditorialItems("game"),
    getEditorialItem("game_taxonomy", "games"),
  ]);
  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;
  const fallbackClassifications = [
    ...new Set(
      games.flatMap((game) => [
        game.payload.category,
        ...(game.payload.genres ?? []),
      ])
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ];
  const classifications = (
    taxonomyItem?.payload.classifications
      .filter((term) => term.active)
      .map((term) => term.label) ?? fallbackClassifications
  ).sort((a, b) => a.localeCompare(b, "es"));
  const existingSlugs = games.map((game) => game.key);

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
          <span>ALTA EDITORIAL</span>
          <h1>Nuevo juego</h1>
          <p>
            Crea el borrador privado y complétalo por etapas. Nada aparece en la web hasta que lo revises y confirmes la publicación.
          </p>
        </div>
        <span className={styles.draftState}>
          <Plus size={15} aria-hidden="true" />
          Borrador oculto
        </span>
      </header>

      <EditorStateNotice state={state} />

      <NewGameForm
        categories={classifications}
        existingSlugs={existingSlugs}
      />
    </>
  );
}
