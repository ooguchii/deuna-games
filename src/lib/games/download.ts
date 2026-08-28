import type { Game } from "@/types/game";

export type ResolvedDownload = {
  href: string;
  label: string;
  external: boolean;
};

const internalBase =
  "https://deuna-internal.invalid";

function resolveInternalHref(
  rawHref: string
) {
  if (
    !rawHref.startsWith("/") ||
    rawHref.startsWith("//") ||
    rawHref.includes("\\")
  ) {
    return null;
  }

  try {
    const url = new URL(
      rawHref,
      internalBase
    );

    if (
      url.origin !== internalBase
    ) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function resolveGameDownload(
  game: Game
): ResolvedDownload | null {
  const rawHref =
    game.download?.href.trim();

  if (!rawHref) {
    return null;
  }

  if (rawHref.startsWith("/")) {
    const internalHref =
      resolveInternalHref(
        rawHref
      );

    if (!internalHref) {
      return null;
    }

    return {
      href: internalHref,
      label:
        game.download?.label ??
        "Descargar versión actual",
      external: false,
    };
  }

  try {
    const url = new URL(rawHref);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return {
      href: url.toString(),
      label:
        game.download?.label ??
        "Descargar versión actual",
      external: true,
    };
  } catch {
    return null;
  }
}
