import {
  MAX_PREVIEW_DURATION_SECONDS,
  MAX_PREVIEW_SOURCE_POSITION_SECONDS,
  parsePreviewTrimWindow,
  type PreviewTrimWindow,
} from "./preview-video-policy";

import type { GameYouTubePreview } from "@/types/game";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

export type ParsedYouTubeVideo = {
  videoId: string;
  canonicalUrl: string;
};

function validVideoId(value: string) {
  return VIDEO_ID_PATTERN.test(value);
}

function protocolAndPortAllowed(url: URL) {
  if (url.protocol === "https:") {
    return !url.port || url.port === "443";
  }

  if (url.protocol === "http:") {
    return !url.port || url.port === "80";
  }

  return false;
}

function normalizedYouTubeInput(value: string) {
  const raw = value.trim();
  if (!raw || validVideoId(raw)) return raw;

  return /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `https://${raw}`;
}

function videoIdFromPath(pathname: string) {
  const parts = pathname
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  if (
    parts[0] === "shorts" ||
    parts[0] === "embed" ||
    parts[0] === "live"
  ) {
    return validVideoId(parts[1] ?? "")
      ? parts[1]!
      : null;
  }

  return null;
}

export function parseYouTubeVideo(
  value: string
): ParsedYouTubeVideo | null {
  const normalized = normalizedYouTubeInput(value);

  if (validVideoId(normalized)) {
    return {
      videoId: normalized,
      canonicalUrl: `https://www.youtube.com/watch?v=${normalized}`,
    };
  }

  let url: URL;

  try {
    url = new URL(normalized);
  } catch {
    return null;
  }

  if (
    !protocolAndPortAllowed(url) ||
    url.username ||
    url.password ||
    url.toString().length > 2_048
  ) {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  let videoId: string | null = null;

  if (
    hostname === "youtu.be" ||
    hostname === "www.youtu.be"
  ) {
    const candidate =
      url.pathname.split("/").filter(Boolean)[0] ?? "";
    videoId = validVideoId(candidate)
      ? candidate
      : null;
  } else if (YOUTUBE_HOSTS.has(hostname)) {
    const queryId =
      url.searchParams.get("v")?.trim() ?? "";
    videoId = validVideoId(queryId)
      ? queryId
      : videoIdFromPath(url.pathname);
  }

  if (!videoId) return null;

  return {
    videoId,
    canonicalUrl:
      `https://www.youtube.com/watch?v=${videoId}`,
  };
}

export function parseYouTubePreview(
  value: string,
  startSeconds: string | number,
  endSeconds: string | number
): GameYouTubePreview | null {
  const parsed = parseYouTubeVideo(value);
  const trim = parsePreviewTrimWindow(
    String(startSeconds),
    String(endSeconds)
  );

  if (!parsed || !trim) return null;

  return {
    videoId: parsed.videoId,
    startSeconds: trim.startSeconds,
    endSeconds: trim.endSeconds,
  };
}

export function validateYouTubePreview(
  preview: GameYouTubePreview | undefined
): preview is GameYouTubePreview {
  if (
    !preview ||
    !validVideoId(preview.videoId)
  ) {
    return false;
  }

  return Boolean(
    parsePreviewTrimWindow(
      String(preview.startSeconds),
      String(preview.endSeconds)
    )
  );
}

export function youtubePreviewTrim(
  preview: GameYouTubePreview
): PreviewTrimWindow | null {
  return parsePreviewTrimWindow(
    String(preview.startSeconds),
    String(preview.endSeconds)
  );
}

export {
  MAX_PREVIEW_DURATION_SECONDS,
  MAX_PREVIEW_SOURCE_POSITION_SECONDS,
};
