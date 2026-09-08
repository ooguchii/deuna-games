"use client";

import {
  useEffect,
  useSyncExternalStore,
} from "react";

export const FAVORITES_STORAGE_KEY =
  "deuna-games:finder-favorites:v2";

const listeners = new Set<() => void>();
const pendingSlugs = new Set<string>();
let favorites = new Set<string>();
let authenticated = false;
let ready = false;
let version = 0;
let errorMessage: string | null = null;
let refreshPromise: Promise<void> | null = null;
let externalListenersInstalled = false;

function emit() {
  version += 1;
  for (const listener of listeners) listener();
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
  } catch {
    // Favoritos locales opcionales: el sitio sigue funcionando sin localStorage.
  }
}

function installExternalListeners() {
  if (externalListenersInstalled) return;
  externalListenersInstalled = true;

  window.addEventListener("storage", (event) => {
    if (
      authenticated ||
      event.storageArea !== window.localStorage ||
      event.key !== FAVORITES_STORAGE_KEY
    ) {
      return;
    }

    favorites = readGuestFavorites();
    errorMessage = null;
    ready = true;
    emit();
  });

  window.addEventListener("focus", () => {
    void refreshFavoriteStore();
  });
}

export async function refreshFavoriteStore() {
  if (typeof window === "undefined") return;

  installExternalListeners();

  if (refreshPromise) {
    await refreshPromise;
    return;
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

      authenticated = payload.authenticated === true;

      if (authenticated && Array.isArray(payload.favorites)) {
        favorites = new Set(
          payload.favorites.filter(
            (value): value is string => typeof value === "string"
          )
        );
      } else {
        favorites = readGuestFavorites();
      }

      ready = true;
      errorMessage = null;
      emit();
    } catch {
      if (!ready) {
        authenticated = false;
        favorites = readGuestFavorites();
        ready = true;
      }
      errorMessage =
        "No se pudo sincronizar favoritos con Mi DeUna.";
      emit();
    } finally {
      refreshPromise = null;
    }
  })();

  await refreshPromise;
}

export async function toggleFavoriteGame(gameSlug: string) {
  if (typeof window === "undefined" || pendingSlugs.has(gameSlug)) {
    return;
  }

  // Confirmamos la autoridad de sesión antes de cada escritura. Así un login
  // o logout ocurrido sin recarga completa no puede mandar el clic al destino
  // anterior (cuenta vs. almacenamiento local de invitado).
  await refreshFavoriteStore();

  const wasFavorite = favorites.has(gameSlug);
  const nextFavorite = !wasFavorite;
  const next = new Set(favorites);

  if (nextFavorite) next.add(gameSlug);
  else next.delete(gameSlug);

  favorites = next;
  pendingSlugs.add(gameSlug);
  errorMessage = null;
  emit();

  if (!authenticated) {
    persistGuestFavorites();
    pendingSlugs.delete(gameSlug);
    emit();
    return;
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
  } catch {
    const rollback = new Set(favorites);
    if (wasFavorite) rollback.add(gameSlug);
    else rollback.delete(gameSlug);
    favorites = rollback;
    errorMessage =
      "No se pudo guardar el favorito. Inténtalo de nuevo.";
    emit();

    // Reconciliamos con la fuente autoritativa después del rollback. Si este
    // GET también falla, conservamos el estado revertido y el mensaje de error.
    await refreshFavoriteStore();
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
    errorMessage,
    toggle: () => toggleFavoriteGame(gameSlug),
  };
}
