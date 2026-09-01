export const DIRECT_PREVIEW_PLATFORM_VALUES = [
  "facebook",
  "instagram",
  "tiktok",
  "vimeo",
  "x",
  "twitch",
  "dailymotion",
  "streamable",
  "kick",
] as const;

export type DirectPreviewPlatformValue =
  (typeof DIRECT_PREVIEW_PLATFORM_VALUES)[number];

const PLATFORM_SET = new Set<string>(
  DIRECT_PREVIEW_PLATFORM_VALUES
);

function normalizeUrlInput(value: string) {
  const raw = value.trim();
  if (!raw) return "";

  return /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `https://${raw}`;
}

function parsePublicHttpUrl(value: string) {
  let url: URL;

  try {
    url = new URL(normalizeUrlInput(value));
  } catch {
    return null;
  }

  const isHttp = url.protocol === "http:";
  const isHttps = url.protocol === "https:";
  const validPort =
    !url.port ||
    (isHttp && url.port === "80") ||
    (isHttps && url.port === "443");

  if (
    (!isHttp && !isHttps) ||
    !validPort ||
    url.username ||
    url.password ||
    !url.hostname ||
    url.toString().length > 2_048
  ) {
    return null;
  }

  return url;
}

function hostnameMatches(hostname: string, allowedHost: string) {
  const clean = hostname.toLowerCase().replace(/\.$/, "");
  return clean === allowedHost || clean.endsWith(`.${allowedHost}`);
}

function parts(url: URL) {
  return url.pathname.split("/").filter(Boolean);
}

function matchesPlatform(
  platform: DirectPreviewPlatformValue,
  url: URL
) {
  const path = parts(url);

  switch (platform) {
    case "facebook":
      return (
        ["facebook.com", "fb.com", "fb.watch"].some((host) =>
          hostnameMatches(url.hostname, host)
        ) && path.length > 0
      );

    case "instagram":
      return (
        ["instagram.com", "instagr.am"].some((host) =>
          hostnameMatches(url.hostname, host)
        ) &&
        ["p", "reel", "tv"].includes(
          path[0]?.toLowerCase() ?? ""
        ) &&
        /^[A-Za-z0-9_-]{5,80}$/.test(path[1] ?? "")
      );

    case "tiktok": {
      if (!hostnameMatches(url.hostname, "tiktok.com")) {
        return false;
      }
      const videoIndex = path.findIndex(
        (part) => part.toLowerCase() === "video"
      );
      const id =
        videoIndex >= 0
          ? path[videoIndex + 1] ?? ""
          : path[0]?.toLowerCase() === "player" &&
              path[1]?.toLowerCase() === "v1"
            ? path[2] ?? ""
            : "";
      return /^\d{8,32}$/.test(id);
    }

    case "vimeo":
      return (
        hostnameMatches(url.hostname, "vimeo.com") &&
        path.some((part) => /^\d{4,20}$/.test(part))
      );

    case "x": {
      if (
        !["x.com", "twitter.com"].some((host) =>
          hostnameMatches(url.hostname, host)
        )
      ) {
        return false;
      }
      const statusIndex = path.findIndex(
        (part) => part.toLowerCase() === "status"
      );
      return (
        statusIndex >= 0 &&
        /^\d{6,30}$/.test(path[statusIndex + 1] ?? "")
      );
    }

    case "twitch": {
      if (hostnameMatches(url.hostname, "clips.twitch.tv")) {
        return /^[A-Za-z0-9_-]{4,120}$/.test(path[0] ?? "");
      }
      if (!hostnameMatches(url.hostname, "twitch.tv")) {
        return false;
      }
      if (path[0]?.toLowerCase() === "videos") {
        return /^\d{4,24}$/.test(path[1] ?? "");
      }
      const clipIndex = path.findIndex(
        (part) => part.toLowerCase() === "clip"
      );
      if (clipIndex >= 0) {
        return /^[A-Za-z0-9_-]{4,120}$/.test(
          path[clipIndex + 1] ?? ""
        );
      }
      return /^[A-Za-z0-9_]{2,40}$/.test(path[0] ?? "");
    }

    case "dailymotion": {
      if (hostnameMatches(url.hostname, "dai.ly")) {
        return /^[A-Za-z0-9]{5,20}$/.test(
          (path[0] ?? "").split("_")[0] ?? ""
        );
      }
      if (!hostnameMatches(url.hostname, "dailymotion.com")) {
        return false;
      }
      const videoIndex = path.findIndex(
        (part) => part.toLowerCase() === "video"
      );
      return (
        videoIndex >= 0 &&
        /^[A-Za-z0-9]{5,20}$/.test(
          (path[videoIndex + 1] ?? "").split("_")[0] ?? ""
        )
      );
    }

    case "streamable": {
      if (!hostnameMatches(url.hostname, "streamable.com")) {
        return false;
      }
      const id =
        path[0]?.toLowerCase() === "e"
          ? path[1] ?? ""
          : path[0] ?? "";
      return /^[A-Za-z0-9]{4,20}$/.test(id);
    }

    case "kick":
      return (
        hostnameMatches(url.hostname, "kick.com") &&
        /^[A-Za-z0-9_-]{2,80}$/.test(path[0] ?? "")
      );
  }
}

function supportsStartOffset(
  platform: DirectPreviewPlatformValue,
  url: URL
) {
  if (
    platform === "facebook" ||
    platform === "tiktok" ||
    platform === "vimeo" ||
    platform === "dailymotion"
  ) {
    return true;
  }

  if (platform !== "twitch") return false;

  const path = parts(url);
  return (
    hostnameMatches(url.hostname, "twitch.tv") &&
    path[0]?.toLowerCase() === "videos" &&
    /^\d{4,24}$/.test(path[1] ?? "")
  );
}

export function isDirectPreviewPlatformValue(
  value: unknown
): value is DirectPreviewPlatformValue {
  return typeof value === "string" && PLATFORM_SET.has(value);
}

export function validateDirectPreviewEditorialValue(value: {
  platform: DirectPreviewPlatformValue;
  url: string;
  startSeconds: number;
  endSeconds: number;
}) {
  const url = parsePublicHttpUrl(value.url);
  if (!url || !matchesPlatform(value.platform, url)) {
    return false;
  }

  if (
    !Number.isFinite(value.startSeconds) ||
    !Number.isFinite(value.endSeconds) ||
    value.startSeconds < 0 ||
    value.endSeconds <= value.startSeconds ||
    value.startSeconds > 86_400 ||
    value.endSeconds > 86_400
  ) {
    return false;
  }

  const durationMilliseconds =
    Math.round(value.endSeconds * 1_000) -
    Math.round(value.startSeconds * 1_000);

  if (
    durationMilliseconds <= 0 ||
    durationMilliseconds > 30_000
  ) {
    return false;
  }

  return (
    supportsStartOffset(value.platform, url) ||
    Math.round(value.startSeconds * 1_000) === 0
  );
}
