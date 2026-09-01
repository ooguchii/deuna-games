const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

export type YouTubeVideoReference = {
  videoId: string;
  canonicalUrl: string;
};

function cleanHostname(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function validVideoId(value: string | null | undefined) {
  if (!value) return null;
  const candidate = value.trim();
  return YOUTUBE_VIDEO_ID_PATTERN.test(candidate)
    ? candidate
    : null;
}

export function parseYouTubeVideoUrl(
  value: string
): YouTubeVideoReference | null {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    return null;
  }

  const hostname = cleanHostname(url.hostname);
  if (!youtubeHosts.has(hostname)) return null;

  let videoId: string | null = null;

  if (
    hostname === "youtu.be" ||
    hostname === "www.youtu.be"
  ) {
    videoId = validVideoId(
      url.pathname.split("/").filter(Boolean)[0]
    );
  } else if (url.pathname === "/watch") {
    videoId = validVideoId(url.searchParams.get("v"));
  } else {
    const parts = url.pathname.split("/").filter(Boolean);
    if (
      parts[0] === "shorts" ||
      parts[0] === "embed" ||
      parts[0] === "live"
    ) {
      videoId = validVideoId(parts[1]);
    }
  }

  if (!videoId) return null;

  return {
    videoId,
    canonicalUrl:
      `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
  };
}

export function isYouTubeHostname(value: string) {
  try {
    return youtubeHosts.has(
      cleanHostname(new URL(value.trim()).hostname)
    );
  } catch {
    return false;
  }
}
