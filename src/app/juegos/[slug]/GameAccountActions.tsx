"use client";

import Link from "next/link";
import {
  Bell,
  Heart,
  ListPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useState,
} from "react";

import styles from "./GameAccountActions.module.css";

type LibraryState =
  | "want_to_play"
  | "playing"
  | "completed"
  | null;

type GamePreference = {
  favorite: boolean;
  libraryState: LibraryState;
  followUpdates: boolean;
} | null;

type PreferenceDraft = {
  favorite: boolean;
  libraryState: LibraryState;
  followUpdates: boolean;
};

type ApiResult = {
  ok?: boolean;
};

export default function GameAccountActions({
  gameSlug,
  signedIn,
  preference,
}: {
  gameSlug: string;
  signedIn: boolean;
  preference: GamePreference;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<PreferenceDraft>({
    favorite: preference?.favorite ?? false,
    libraryState: preference?.libraryState ?? null,
    followUpdates: preference?.followUpdates ?? false,
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <div className={styles.signedOut}>
        <span>
          <ListPlus size={16} aria-hidden="true" />
          Guardá este juego en Mi DeUna
        </span>
        <Link href="/cuenta?modo=entrar">
          Entrar para guardar
        </Link>
      </div>
    );
  }

  async function save(next: PreferenceDraft) {
    if (pending) return;

    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/account/games", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({
          gameSlug,
          favorite: String(next.favorite),
          libraryState: next.libraryState ?? "none",
          followUpdates: String(next.followUpdates),
        }).toString(),
      });
      const result = (await response.json()) as ApiResult;

      if (!response.ok || !result.ok) {
        setMessage("No se pudo guardar el cambio.");
        return;
      }

      setDraft(next);
      setMessage("Mi DeUna actualizado");
      router.refresh();
    } catch {
      setMessage("No se pudo conectar con Mi DeUna.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={styles.panel}
      aria-label="Guardar este juego en Mi DeUna"
    >
      <div className={styles.heading}>
        <span>MI DEUNA</span>
        {message && (
          <small role="status">{message}</small>
        )}
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.toggle}
          data-active={draft.favorite}
          aria-pressed={draft.favorite}
          disabled={pending}
          onClick={() =>
            save({
              ...draft,
              favorite: !draft.favorite,
            })
          }
        >
          <Heart
            size={17}
            fill={draft.favorite ? "currentColor" : "none"}
            aria-hidden="true"
          />
          {draft.favorite ? "Favorito" : "Guardar favorito"}
        </button>

        <label className={styles.stateControl}>
          <span>Estado</span>
          <select
            value={draft.libraryState ?? "none"}
            disabled={pending}
            onChange={(event) => {
              const value = event.target.value;
              const libraryState: LibraryState =
                value === "want_to_play" ||
                value === "playing" ||
                value === "completed"
                  ? value
                  : null;

              void save({
                ...draft,
                libraryState,
              });
            }}
          >
            <option value="none">Sin lista</option>
            <option value="want_to_play">Quiero jugarlo</option>
            <option value="playing">Lo estoy jugando</option>
            <option value="completed">Terminado</option>
          </select>
        </label>

        <button
          type="button"
          className={styles.toggle}
          data-active={draft.followUpdates}
          aria-pressed={draft.followUpdates}
          disabled={pending}
          onClick={() =>
            save({
              ...draft,
              followUpdates: !draft.followUpdates,
            })
          }
        >
          <Bell
            size={17}
            fill={draft.followUpdates ? "currentColor" : "none"}
            aria-hidden="true"
          />
          {draft.followUpdates
            ? "Siguiendo actualizaciones"
            : "Seguir actualizaciones"}
        </button>
      </div>
    </div>
  );
}
