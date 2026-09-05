"use client";

import {
  type FormEvent,
  useCallback,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import type { ResolvedHomeConfig } from "@/data/home-config";
import type { Game } from "@/types/game";

import HomeCurationEditor from "./HomeCurationEditor";
import HomePresentationEditor from "./HomePresentationEditor";
import styles from "./HomeContentEditor.module.css";

const combinedAction = "/api/admin/content/home/content";

export default function HomeContentEditor({
  config,
  games,
  publishedSlugs,
  revision,
}: {
  config: ResolvedHomeConfig;
  games: Game[];
  publishedSlugs: string[];
  revision: number;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const saveAll = useCallback(async (root: HTMLElement) => {
    if (saving) return;

    const curation = root.querySelector<HTMLInputElement>(
      'input[name="curationJson"]'
    );
    const presentation = root.querySelector<HTMLInputElement>(
      'input[name="presentationJson"]'
    );

    if (!curation || !presentation) {
      setError(true);
      return;
    }

    setSaving(true);
    setError(false);

    const body = new FormData();
    body.set("expectedRevision", String(revision));
    body.set("curationJson", curation.value);
    body.set("presentationJson", presentation.value);

    try {
      const response = await fetch(combinedAction, {
        method: "POST",
        body,
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error(
          `El guardado conjunto respondió ${response.status}.`
        );
      }

      if (response.redirected) {
        const target = new URL(response.url);
        router.replace(`${target.pathname}${target.search}`);
      }
      router.refresh();
    } catch (saveError) {
      console.error(
        "No se pudo guardar Resto de Inicio de forma coordinada.",
        saveError
      );
      setSaving(false);
      setError(true);
    }
  }, [revision, router, saving]);

  const interceptChildSubmit = useCallback(
    (event: FormEvent<HTMLDivElement>) => {
      const form = event.target as HTMLFormElement;
      if (!(form instanceof HTMLFormElement)) return;
      if (
        !form.querySelector('input[name="curationJson"]') &&
        !form.querySelector('input[name="presentationJson"]')
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void saveAll(event.currentTarget);
    },
    [saveAll]
  );

  return (
    <div
      className={styles.root}
      data-saving={saving ? "true" : "false"}
      aria-busy={saving}
      onSubmitCapture={interceptChildSubmit}
    >
      <div
        className={styles.notice}
        data-kind={error ? "error" : "info"}
        role={error ? "alert" : "status"}
      >
        <div>
          <strong>
            {error
              ? "El guardado conjunto no pudo completarse"
              : "Resto de Inicio funciona como una sola revisión"}
          </strong>
          <span>
            {error
              ? "Tus cambios siguen conservados en esta pestaña. Revisa la conexión y vuelve a guardar."
              : "Curaduría, orden, visibilidad y textos se guardan juntos. Pulsar Guardar en cualquiera de los dos bloques conserva todos los cambios pendientes antes de crear la nueva revisión."}
          </span>
        </div>
        <b>{saving ? "GUARDANDO…" : `REVISIÓN ${revision}`}</b>
      </div>

      <HomeCurationEditor
        config={config}
        games={games}
        publishedSlugs={publishedSlugs}
        revision={revision}
        excludeHero
      />
      <HomePresentationEditor
        config={config}
        revision={revision}
      />
    </div>
  );
}
