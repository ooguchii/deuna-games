import Link from "next/link";
import {
  ArrowLeft,
  Plus,
} from "lucide-react";

import EditorStateNotice from "@/components/admin/EditorStateNotice";
import NewGameForm from "@/components/admin/NewGameForm";
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

export default async function AdminNewGamePage({
  searchParams,
}: PageProps) {
  await verifyAdminSession();
  const [parameters, games] = await Promise.all([
    searchParams,
    listEditorialItems("game"),
  ]);
  const state = Array.isArray(parameters.estado)
    ? parameters.estado[0]
    : parameters.estado;
  const categories = [
    ...new Set(
      games
        .map((game) => game.payload.category.trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));

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

      <NewGameForm categories={categories} />
    </>
  );
}
