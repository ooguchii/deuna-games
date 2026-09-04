"use client";

import Link from "next/link";
import {
  Bell,
  Heart,
  ListPlus,
  Star,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
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
  rating?: number | null;
};

export default function GameAccountActions({
  gameSlug,
  signedIn,
  preference,
  rating,
}: {
  gameSlug: string;
  signedIn: boolean;
  preference: GamePreference;
  rating?: number | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<PreferenceDraft>({
    favorite: preference?.favorite ?? false,
    libraryState: preference?.libraryState ?? null,
    followUpdates: preference?.followUpdates ?? false,
  });
  const [userRating, setUserRating] = useState<number | null>(
    rating ?? null
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn || rating !== undefined) return;

    const controller = new AbortController();
    void fetch(
      `/api/account/games/rating?gameSlug=${encodeURIComponent(gameSlug)}`,
      {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      }
    )
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as ApiResult;
      })
      .then((result) => {
        if (!controller.signal.aborted && result?.ok) {
          setUserRating(
            typeof result.rating === "number" ? result.rating : null
          );
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [gameSlug, rating, signedIn]);

  if (!signedIn) {
    return (
      <div className={styles.signedOut}>
        <span>
          <ListPlus size={16} aria-hidden="true" />
          Guarda y valora este juego en Mi DeUna
        </span>
        <Link href="/cuenta?modo=entrar">
          Entrar para participar
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
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
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

  async function saveRating(nextRating: number) {
    if (pending) return;
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/account/games/rating", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({
          gameSlug,
          rating: String(nextRating),
        }).toString(),
      });
      const result = (await response.json()) as ApiResult;

      if (!response.ok || !result.ok) {
        setMessage("No se pudo guardar tu valoración.");
        return;
      }

      setUserRating(nextRating);
      setMessage(`Valoración guardada · ${nextRating}/5`);
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
      aria-label="Guardar y valorar este juego en Mi DeUna"
    >
      <div className={styles.heading}>
        <span>MI DEUNA</span>
        {message && <small role="status">{message}</small>}
      </div>

      <div className={styles.ratingRow}>
        <span>Tu valoración</span>
        <div className={styles.stars} role="group" aria-label="Valorar del 1 al 5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              disabled={pending}
              data-active={userRating !== null && value <= userRating}
              aria-label={`${value} ${value === 1 ? "estrella" : "estrellas"}`}
              aria-pressed={userRating === value}
              onClick={() => void saveRating(value)}
            >
              <Star
                size={18}
                fill={userRating !== null && value <= userRating ? "currentColor" : "none"}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
        <small>{userRating ? `${userRating}/5` : "Sin valorar"}</small>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.toggle}
          data-active={draft.favorite}
          aria-pressed={draft.favorite}
          disabled={pending}
          onClick={() => save({ ...draft, favorite: !draft.favorite })}
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
              void save({ ...draft, libraryState });
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
          onClick={() => save({
            ...draft,
            followUpdates: !draft.followUpdates,
          })}
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
