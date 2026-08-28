import type {
  Game,
  GameDownloadSource,
} from "@/types/game";

export type ResolvedDownloadSource = {
  id: string;
  name: string;
  href: string;
  label: string;
  external: boolean;
};

export type ResolvedDownload = {
  href: string;
  label: string;
  external: boolean;
  sources: ResolvedDownloadSource[];
  sizeGb?: number;
  fileCount?: number;
  platform?: string;
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

function resolveHref(
  rawHref: string
) {
  const href = rawHref.trim();

  if (!href) {
    return null;
  }

  if (href.startsWith("/")) {
    const internalHref =
      resolveInternalHref(href);

    if (!internalHref) {
      return null;
    }

    return {
      href: internalHref,
      external: false,
    };
  }

  try {
    const url = new URL(href);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return {
      href: url.toString(),
      external: true,
    };
  } catch {
    return null;
  }
}

function resolveSource(
  source: GameDownloadSource,
  fallbackIndex: number
): ResolvedDownloadSource | null {
  const resolved =
    resolveHref(source.href);

  if (!resolved) {
    return null;
  }

  const name = source.name.trim();
  const id = source.id.trim();

  if (!name || !id) {
    return null;
  }

  return {
    id: id || `source-${fallbackIndex + 1}`,
    name,
    href: resolved.href,
    external: resolved.external,
    label:
      source.label?.trim() ||
      `Abrir ${name}`,
  };
}

export function resolveGameDownload(
  game: Game
): ResolvedDownload | null {
  const config = game.download;

  if (!config) {
    return null;
  }

  const sources: ResolvedDownloadSource[] = [];
  const seenHrefs = new Set<string>();

  for (const [index, source] of
    (config.sources ?? []).entries()) {
    const resolved = resolveSource(
      source,
      index
    );

    if (
      !resolved ||
      seenHrefs.has(resolved.href)
    ) {
      continue;
    }

    seenHrefs.add(resolved.href);
    sources.push(resolved);
  }

  if (config.href) {
    const resolved =
      resolveHref(config.href);

    if (
      resolved &&
      !seenHrefs.has(resolved.href)
    ) {
      sources.unshift({
        id: "primary",
        name: "Descarga principal",
        href: resolved.href,
        external: resolved.external,
        label:
          config.label?.trim() ||
          "Descargar versión actual",
      });
    }
  }

  const primary = sources[0];

  if (!primary) {
    return null;
  }

  return {
    href: primary.href,
    label: primary.label,
    external: primary.external,
    sources,
    sizeGb:
      typeof config.sizeGb === "number" &&
      Number.isFinite(config.sizeGb) &&
      config.sizeGb > 0
        ? config.sizeGb
        : undefined,
    fileCount:
      typeof config.fileCount === "number" &&
      Number.isInteger(config.fileCount) &&
      config.fileCount > 0
        ? config.fileCount
        : undefined,
    platform:
      config.platform?.trim() ||
      undefined,
  };
}
