"use client";

import {
  useEffect,
  useSyncExternalStore,
} from "react";

export const FAVORITES_STORAGE_KEY =
  "deuna-games:finder-favorites:v2";

type FavoriteAuthority = "unknown" | "guest" | "account";

const listeners = new Set<() => void>();
const pendingSlugs = new Set<string>();
const optimisticOverrides = new Map<string, boolean>();
let favorites = new Set<string>();
let authority: FavoriteAuthority = "unknown";
let ready = false;
let version = 0;
let errorMessage: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let externalListenersInstalled = false;

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

function withOptimisticOverrides(source: Set<string>) {
  const next = new Set(source);

  for (const [gameSlug, favorite] of optimisticOverrides) {
    if (favorite) next.add(gameSlug);
    else next.delete(gameSlug);
  }

  return next;
}

function readGuestFavorites() {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return new Set<string>();

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set<string>();

    return new Set(
      parsed.filter(
        (value): value is string =>
          typeof value === "string" &&
          /^[a-z0-9][a-z0-9._-]{0,159}$/.test(value)
      )
    );
  } catch {
    return new Set<string>();
  }
}

function persistGuestFavorites() {
  try {
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify([...favorites])
    );
    return true;
  } catch {
    return false;
  }
}

function installExternalListeners() {
  if (externalListenersInstalled) return;
  externalListenersInstalled = true;

  window.addEventListener("storage", (event) => {
    if (
      authority !== "guest" ||
      event.storageArea !== window.localStorage ||
      event.key !== FAVORITES_STORAGE_KEY
    ) {
      return;
    }

    favorites = withOptimisticOverrides(readGuestFavorites());
    errorMessage = null;
    ready = true;
    emit();
  });

  window.addEventListener("focus", () => {
    void refreshFavoriteStore();
  });
}

export async function refreshFavoriteStore() {
  if (typeof window === "undefined") return false;

  installExternalListeners();

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch("/api/account/favorites", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        authenticated?: boolean;
        favorites?: unknown;
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error("No se pudieron cargar los favoritos.");
      }

      authority = payload.authenticated === true
        ? "account"
        : "guest";

      const authoritativeFavorites =
        authority === "account" && Array.isArray(payload.favorites)
          ? new Set(
              payload.favorites.filter(
                (value): value is string => typeof value === "string"
              )
            )
          : readGuestFavorites();

      favorites = withOptimisticOverrides(authoritativeFavorites);
      ready = true;
      errorMessage = null;
      emit();
      return true;
    } catch {
      // No inferimos que una cuenta sea invitada sólo porque la API falló.
      // Conservamos el último snapshot visible, pero cualquier escritura queda
      // bloqueada hasta poder volver a confirmar la autoridad de sesión.
      ready = true;
      errorMessage =
        "No se pudo sincronizar favoritos con Mi DeUna.";
      emit();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function toggleFavoriteGame(gameSlug: string) {
  if (typeof window === "undefined" || pendingSlugs.has(gameSlug)) {
    return false;
  }

  pendingSlugs.add(gameSlug);
  errorMessage = null;
  emit();

  try {
    // Confirmamos la autoridad de sesión antes de cada escritura. Así un login,
    // logout o expiración de sesión no puede mandar el clic al destino anterior.
    const synchronized = await refreshFavoriteStore();

    if (!synchronized || authority === "unknown") {
      errorMessage =
        "No se pudo confirmar tu sesión. El favorito no se modificó.";
      emit();
      return false;
    }

    const wasFavorite = favorites.has(gameSlug);
    const nextFavorite = !wasFavorite;
    optimisticOverrides.set(gameSlug, nextFavorite);
    favorites = withOptimisticOverrides(favorites);
    errorMessage = null;
    emit();

    if (authority === "guest") {
      if (persistGuestFavorites()) {
        optimisticOverrides.delete(gameSlug);
        return true;
      }

      optimisticOverrides.delete(gameSlug);
      const rollback = new Set(favorites);
      if (wasFavorite) rollback.add(gameSlug);
      else rollback.delete(gameSlug);
      favorites = withOptimisticOverrides(rollback);
      errorMessage =
        "El navegador no permitió guardar el favorito local.";
      emit();
      return false;
    }

    try {
      const response = await fetch("/api/account/favorites", {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({
          gameSlug,
          favorite: String(nextFavorite),
        }).toString(),
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "favorito");
      }

      optimisticOverrides.delete(gameSlug);
      return true;
    } catch {
      optimisticOverrides.delete(gameSlug);

      // Reconciliamos con la fuente autoritativa. Cualquier otra mutación que
      // siga en vuelo se vuelve a superponer mediante optimisticOverrides.
      await refreshFavoriteStore();
      errorMessage =
        "No se pudo guardar el favorito. Inténtalo de nuevo.";
      emit();
      return false;
    }
  } finally {
    pendingSlugs.delete(gameSlug);
    emit();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getVersion() {
  return version;
}

function getServerVersion() {
  return 0;
}

export function useFavoriteGame(gameSlug: string) {
  useSyncExternalStore(
    subscribe,
    getVersion,
    getServerVersion
  );

  useEffect(() => {
    void refreshFavoriteStore();
  }, []);

  return {
    favorite: favorites.has(gameSlug),
    pending: pendingSlugs.has(gameSlug),
    ready,
    authority,
    errorMessage,
    toggle: () => toggleFavoriteGame(gameSlug),
  };
}
