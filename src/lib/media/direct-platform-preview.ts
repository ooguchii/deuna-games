import {
  MAX_PREVIEW_DURATION_SECONDS,
  MAX_PREVIEW_SOURCE_POSITION_SECONDS,
  parsePreviewTrimWindow,
  type PreviewTrimWindow,
} from "./preview-video-policy";

import type {
  GameDirectPreview,
  GameDirectPreviewPlatform,
} from "@/types/game";

export type DirectPreviewResourceKind =
  | "video"
  | "post"
  | "clip"
  | "vod"
  | "live";

export type ParsedDirectPlatformVideo = {
  platform: GameDirectPreviewPlatform;
  label: string;
  canonicalUrl: string;
  resourceId: string;
  resourceKind: DirectPreviewResourceKind;
  supportsStartOffset: boolean;
};

type DirectPreviewOption = {
  platform: GameDirectPreviewPlatform;
  label: string;
  placeholder: string;
};

export const DIRECT_PREVIEW_OPTIONS: readonly DirectPreviewOption[] = [
  {
    platform: "facebook",
    label: "Facebook",
    placeholder: "facebook.com/.../videos/... o fb.watch/...",
  },
  {
    platform: "instagram",
    label: "Instagram",
    placeholder: "instagram.com/reel/... o instagram.com/p/...",
  },
  {
    platform: "tiktok",
    label: "TikTok",
    placeholder: "tiktok.com/@usuario/video/123...",
  },
  {
    platform: "vimeo",
    label: "Vimeo",
    placeholder: "vimeo.com/123456789",
  },
  {
    platform: "x",
    label: "X / Twitter",
    placeholder: "x.com/usuario/status/123...",
  },
  {
    platform: "twitch",
    label: "Twitch",
    placeholder: "twitch.tv/videos/... · clips.twitch.tv/... · twitch.tv/canal",
  },
  {
    platform: "dailymotion",
    label: "Dailymotion",
    placeholder: "dailymotion.com/video/... o dai.ly/...",
  },
  {
    platform: "streamable",
    label: "Streamable",
    placeholder: "streamable.com/abc123",
  },
  {
    platform: "kick",
    label: "Kick",
    placeholder: "kick.com/canal",
  },
] as const;

const DIRECT_PLATFORM_SET = new Set<GameDirectPreviewPlatform>(
  DIRECT_PREVIEW_OPTIONS.map((option) => option.platform)
);

function normalizedUrlInput(value: string) {
  const raw = value.trim();
  if (!raw) return "";

  return /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `https://${raw}`;
}

function parseHttpUrl(value: string) {
  let url: URL;

  try {
    url = new URL(normalizedUrlInput(value));
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

function firstPathPart(url: URL) {
  return url.pathname.split("/").filter(Boolean)[0] ?? "";
}

function pathParts(url: URL) {
  return url.pathname.split("/").filter(Boolean);
}

function canonicalHttps(hostname: string, pathname: string) {
  return `https://${hostname}${pathname}`;
}

function parseFacebook(url: URL): ParsedDirectPlatformVideo | null {
  const hostAllowed = ["facebook.com", "fb.com", "fb.watch"].some(
    (host) => hostnameMatches(url.hostname, host)
  );
  if (!hostAllowed) return null;

  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return null;

  const canonical = new URL(url.toString());
  canonical.protocol = "https:";
  canonical.port = "";
  canonical.hash = "";

  return {
    platform: "facebook",
    label: "Facebook",
    canonicalUrl: canonical.toString(),
    resourceId: canonical.pathname,
    resourceKind: "video",
    supportsStartOffset: false,
  };
}

function parseInstagram(url: URL): ParsedDirectPlatformVideo | null {
  if (
    !["instagram.com", "instagr.am"].some((host) =>
      hostnameMatches(url.hostname, host)
    )
  ) {
    return null;
  }

  const parts = pathParts(url);
  const kind = parts[0]?.toLowerCase();
  const shortcode = parts[1] ?? "";

  if (
    !["p", "reel", "tv"].includes(kind ?? "") ||
    !/^[A-Za-z0-9_-]{5,80}$/.test(shortcode)
  ) {
    return null;
  }

  return {
    platform: "instagram",
    label: "Instagram",
    canonicalUrl: `https://www.instagram.com/${kind}/${shortcode}/`,
    resourceId: shortcode,
    resourceKind: "post",
    supportsStartOffset: false,
  };
}

function parseTikTok(url: URL): ParsedDirectPlatformVideo | null {
  if (!hostnameMatches(url.hostname, "tiktok.com")) return null;

  const parts = pathParts(url);
  let id = "";

  const videoIndex = parts.findIndex(
    (part) => part.toLowerCase() === "video"
  );
  if (videoIndex >= 0) id = parts[videoIndex + 1] ?? "";

  if (
    !id &&
    parts[0]?.toLowerCase() === "player" &&
    parts[1]?.toLowerCase() === "v1"
  ) {
    id = parts[2] ?? "";
  }

  if (!/^\d{8,32}$/.test(id)) return null;

  return {
    platform: "tiktok",
    label: "TikTok",
    canonicalUrl: url.pathname.includes("/video/")
      ? canonicalHttps("www.tiktok.com", url.pathname)
      : `https://www.tiktok.com/player/v1/${id}`,
    resourceId: id,
    resourceKind: "video",
    supportsStartOffset: true,
  };
}

function parseVimeo(url: URL): ParsedDirectPlatformVideo | null {
  if (!hostnameMatches(url.hostname, "vimeo.com")) return null;

  const id = [...pathParts(url)]
    .reverse()
    .find((part) => /^\d{4,20}$/.test(part));
  if (!id) return null;

  return {
    platform: "vimeo",
    label: "Vimeo",
    canonicalUrl: `https://vimeo.com/${id}`,
    resourceId: id,
    resourceKind: "video",
    supportsStartOffset: true,
  };
}

function parseX(url: URL): ParsedDirectPlatformVideo | null {
  if (
    !["x.com", "twitter.com"].some((host) =>
      hostnameMatches(url.hostname, host)
    )
  ) {
    return null;
  }

  const parts = pathParts(url);
  const statusIndex = parts.findIndex(
    (part) => part.toLowerCase() === "status"
  );
  const id = statusIndex >= 0 ? parts[statusIndex + 1] ?? "" : "";
  if (!/^\d{6,30}$/.test(id)) return null;

  const author = statusIndex > 0 ? parts[statusIndex - 1] : "i";

  return {
    platform: "x",
    label: "X / Twitter",
    canonicalUrl: `https://x.com/${encodeURIComponent(author)}/status/${id}`,
    resourceId: id,
    resourceKind: "post",
    supportsStartOffset: false,
  };
}

function parseTwitch(url: URL): ParsedDirectPlatformVideo | null {
  const parts = pathParts(url);

  if (hostnameMatches(url.hostname, "clips.twitch.tv")) {
    const slug = parts[0] ?? "";
    if (!/^[A-Za-z0-9_-]{4,120}$/.test(slug)) return null;
    return {
      platform: "twitch",
      label: "Twitch",
      canonicalUrl: `https://clips.twitch.tv/${slug}`,
      resourceId: slug,
      resourceKind: "clip",
      supportsStartOffset: false,
    };
  }

  if (!hostnameMatches(url.hostname, "twitch.tv")) return null;

  if (parts[0]?.toLowerCase() === "videos") {
    const id = parts[1] ?? "";
    if (!/^\d{4,24}$/.test(id)) return null;
    return {
      platform: "twitch",
      label: "Twitch",
      canonicalUrl: `https://www.twitch.tv/videos/${id}`,
      resourceId: id,
      resourceKind: "vod",
      supportsStartOffset: true,
    };
  }

  const clipIndex = parts.findIndex(
    (part) => part.toLowerCase() === "clip"
  );
  if (clipIndex >= 0) {
    const slug = parts[clipIndex + 1] ?? "";
    if (!/^[A-Za-z0-9_-]{4,120}$/.test(slug)) return null;
    return {
      platform: "twitch",
      label: "Twitch",
      canonicalUrl: `https://clips.twitch.tv/${slug}`,
      resourceId: slug,
      resourceKind: "clip",
      supportsStartOffset: false,
    };
  }

  const channel = parts[0] ?? "";
  if (!/^[A-Za-z0-9_]{2,40}$/.test(channel)) return null;

  return {
    platform: "twitch",
    label: "Twitch",
    canonicalUrl: `https://www.twitch.tv/${channel}`,
    resourceId: channel,
    resourceKind: "live",
    supportsStartOffset: false,
  };
}

function parseDailymotion(url: URL): ParsedDirectPlatformVideo | null {
  let id = "";

  if (hostnameMatches(url.hostname, "dai.ly")) {
    id = firstPathPart(url);
  } else if (hostnameMatches(url.hostname, "dailymotion.com")) {
    const parts = pathParts(url);
    const videoIndex = parts.findIndex(
      (part) => part.toLowerCase() === "video"
    );
    id = videoIndex >= 0 ? parts[videoIndex + 1] ?? "" : "";
  } else {
    return null;
  }

  id = id.split("_")[0] ?? "";
  if (!/^[A-Za-z0-9]{5,20}$/.test(id)) return null;

  return {
    platform: "dailymotion",
    label: "Dailymotion",
    canonicalUrl: `https://www.dailymotion.com/video/${id}`,
    resourceId: id,
    resourceKind: "video",
    supportsStartOffset: true,
  };
}

function parseStreamable(url: URL): ParsedDirectPlatformVideo | null {
  if (!hostnameMatches(url.hostname, "streamable.com")) return null;

  const parts = pathParts(url);
  const id = parts[0]?.toLowerCase() === "e"
    ? parts[1] ?? ""
    : parts[0] ?? "";
  if (!/^[A-Za-z0-9]{4,20}$/.test(id)) return null;

  return {
    platform: "streamable",
    label: "Streamable",
    canonicalUrl: `https://streamable.com/${id}`,
    resourceId: id,
    resourceKind: "video",
    supportsStartOffset: false,
  };
}

function parseKick(url: URL): ParsedDirectPlatformVideo | null {
  if (!hostnameMatches(url.hostname, "kick.com")) return null;

  const channel = firstPathPart(url);
  if (!/^[A-Za-z0-9_-]{2,80}$/.test(channel)) return null;

  return {
    platform: "kick",
    label: "Kick",
    canonicalUrl: `https://kick.com/${channel}`,
    resourceId: channel,
    resourceKind: "live",
    supportsStartOffset: false,
  };
}

export function isGameDirectPreviewPlatform(
  value: unknown
): value is GameDirectPreviewPlatform {
  return (
    typeof value === "string" &&
    DIRECT_PLATFORM_SET.has(value as GameDirectPreviewPlatform)
  );
}

export function directPreviewPlatformLabel(
  platform: GameDirectPreviewPlatform
) {
  return DIRECT_PREVIEW_OPTIONS.find(
    (option) => option.platform === platform
  )?.label ?? platform;
}

export function parseDirectPlatformVideo(
  platform: GameDirectPreviewPlatform,
  value: string
): ParsedDirectPlatformVideo | null {
  const url = parseHttpUrl(value);
  if (!url) return null;

  switch (platform) {
    case "facebook":
      return parseFacebook(url);
    case "instagram":
      return parseInstagram(url);
    case "tiktok":
      return parseTikTok(url);
    case "vimeo":
      return parseVimeo(url);
    case "x":
      return parseX(url);
    case "twitch":
      return parseTwitch(url);
    case "dailymotion":
      return parseDailymotion(url);
    case "streamable":
      return parseStreamable(url);
    case "kick":
      return parseKick(url);
  }
}

export function parseDirectPlatformPreview(
  platform: GameDirectPreviewPlatform,
  value: string,
  startSeconds: string | number,
  endSeconds: string | number
): GameDirectPreview | null {
  const parsed = parseDirectPlatformVideo(platform, value);
  const trim = parsePreviewTrimWindow(
    String(startSeconds),
    String(endSeconds)
  );

  if (!parsed || !trim) return null;
  if (!parsed.supportsStartOffset && trim.startSeconds !== 0) {
    return null;
  }

  return {
    platform,
    url: parsed.canonicalUrl,
    startSeconds: trim.startSeconds,
    endSeconds: trim.endSeconds,
  };
}

export function validateDirectPlatformPreview(
  preview: GameDirectPreview | undefined
): preview is GameDirectPreview {
  if (!preview || !isGameDirectPreviewPlatform(preview.platform)) {
    return false;
  }

  return Boolean(
    parseDirectPlatformPreview(
      preview.platform,
      preview.url,
      preview.startSeconds,
      preview.endSeconds
    )
  );
}

export function directPreviewTrim(
  preview: GameDirectPreview
): PreviewTrimWindow | null {
  return parsePreviewTrimWindow(
    String(preview.startSeconds),
    String(preview.endSeconds)
  );
}

export function buildDirectPlatformEmbedUrl(
  preview: GameDirectPreview,
  options?: {
    autoplay?: boolean;
    muted?: boolean;
    parentHostname?: string;
  }
) {
  const parsed = parseDirectPlatformVideo(
    preview.platform,
    preview.url
  );
  if (!parsed) return null;

  const autoplay = options?.autoplay ?? false;
  const muted = options?.muted ?? true;
  const parentHostname = options?.parentHostname?.trim() || "localhost";

  switch (parsed.platform) {
    case "facebook": {
      const embed = new URL(
        "https://www.facebook.com/plugins/video.php"
      );
      embed.searchParams.set("href", parsed.canonicalUrl);
      embed.searchParams.set("show_text", "false");
      embed.searchParams.set("width", "560");
      if (autoplay) embed.searchParams.set("autoplay", "true");
      return embed.toString();
    }

    case "instagram": {
      const canonical = new URL(parsed.canonicalUrl);
      return `${canonical.origin}${canonical.pathname}embed/`;
    }

    case "tiktok": {
      const embed = new URL(
        `https://www.tiktok.com/player/v1/${parsed.resourceId}`
      );
      embed.searchParams.set("controls", "1");
      embed.searchParams.set("fullscreen_button", "1");
      embed.searchParams.set("volume_control", "1");
      if (autoplay) embed.searchParams.set("autoplay", "1");
      if (muted) embed.searchParams.set("muted", "1");
      return embed.toString();
    }

    case "vimeo": {
      const embed = new URL(
        `https://player.vimeo.com/video/${parsed.resourceId}`
      );
      embed.searchParams.set("playsinline", "1");
      if (autoplay) embed.searchParams.set("autoplay", "1");
      if (muted) embed.searchParams.set("muted", "1");
      if (autoplay) embed.searchParams.set("controls", "0");
      const base = embed.toString();
      return preview.startSeconds > 0
        ? `${base}#t=${preview.startSeconds}s`
        : base;
    }

    case "x": {
      const embed = new URL(
        "https://platform.twitter.com/embed/Tweet.html"
      );
      embed.searchParams.set("id", parsed.resourceId);
      embed.searchParams.set("dnt", "true");
      embed.searchParams.set("theme", "dark");
      return embed.toString();
    }

    case "twitch": {
      if (parsed.resourceKind === "clip") {
        const embed = new URL("https://clips.twitch.tv/embed");
        embed.searchParams.set("clip", parsed.resourceId);
        embed.searchParams.set("parent", parentHostname);
        embed.searchParams.set("autoplay", String(autoplay));
        embed.searchParams.set("muted", String(muted));
        return embed.toString();
      }

      const embed = new URL("https://player.twitch.tv/");
      if (parsed.resourceKind === "vod") {
        embed.searchParams.set("video", `v${parsed.resourceId}`);
        if (preview.startSeconds > 0) {
          embed.searchParams.set(
            "time",
            `${Math.floor(preview.startSeconds)}s`
          );
        }
      } else {
        embed.searchParams.set("channel", parsed.resourceId);
      }
      embed.searchParams.set("parent", parentHostname);
      embed.searchParams.set("autoplay", String(autoplay));
      embed.searchParams.set("muted", String(muted));
      return embed.toString();
    }

    case "dailymotion": {
      const embed = new URL(
        "https://geo.dailymotion.com/player.html"
      );
      embed.searchParams.set("video", parsed.resourceId);
      if (autoplay) embed.searchParams.set("autoplay", "true");
      if (muted) embed.searchParams.set("mute", "true");
      if (preview.startSeconds > 0) {
        embed.searchParams.set(
          "startTime",
          String(preview.startSeconds)
        );
      }
      return embed.toString();
    }

    case "streamable": {
      const embed = new URL(
        `https://streamable.com/e/${parsed.resourceId}`
      );
      if (autoplay) embed.searchParams.set("autoplay", "1");
      if (muted) embed.searchParams.set("muted", "1");
      return embed.toString();
    }

    case "kick": {
      const embed = new URL(
        `https://player.kick.com/${parsed.resourceId}`
      );
      if (autoplay) embed.searchParams.set("autoplay", "true");
      if (muted) embed.searchParams.set("muted", "true");
      return embed.toString();
    }
  }
}

export {
  MAX_PREVIEW_DURATION_SECONDS,
  MAX_PREVIEW_SOURCE_POSITION_SECONDS,
};