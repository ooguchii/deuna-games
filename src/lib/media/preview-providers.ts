export const PREVIEW_PROVIDER_IDS = [
  "youtube", "facebook", "instagram", "tiktok", "vimeo", "x", "twitch",
  "dailymotion", "streamable", "kick", "reddit", "pinterest", "snapchat",
] as const;

export type PreviewProviderId = (typeof PREVIEW_PROVIDER_IDS)[number];

export type PreviewProviderSpec = {
  id: PreviewProviderId;
  label: string;
  placeholder: string;
  hosts: readonly string[];
  player: "youtube" | "facebook" | "instagram" | "tiktok" | "vimeo" | "twitch" | "dailymotion" | "streamable" | "kick" | "native";
};

const providers: Record<PreviewProviderId, PreviewProviderSpec> = {
  youtube: { id: "youtube", label: "YouTube", placeholder: "youtube.com/watch?v=... · youtu.be/... · Shorts", hosts: ["youtube.com", "youtu.be", "youtube-nocookie.com"], player: "youtube" },
  facebook: { id: "facebook", label: "Facebook", placeholder: "facebook.com/.../videos/... · fb.watch/...", hosts: ["facebook.com", "fb.watch", "fb.com"], player: "facebook" },
  instagram: { id: "instagram", label: "Instagram", placeholder: "instagram.com/reel/... · instagram.com/p/...", hosts: ["instagram.com", "instagr.am"], player: "instagram" },
  tiktok: { id: "tiktok", label: "TikTok", placeholder: "tiktok.com/@usuario/video/...", hosts: ["tiktok.com"], player: "tiktok" },
  vimeo: { id: "vimeo", label: "Vimeo", placeholder: "vimeo.com/123456789", hosts: ["vimeo.com"], player: "vimeo" },
  x: { id: "x", label: "X / Twitter", placeholder: "x.com/usuario/status/...", hosts: ["x.com", "twitter.com", "t.co"], player: "native" },
  twitch: { id: "twitch", label: "Twitch", placeholder: "twitch.tv/videos/... · clips.twitch.tv/...", hosts: ["twitch.tv"], player: "twitch" },
  dailymotion: { id: "dailymotion", label: "Dailymotion", placeholder: "dailymotion.com/video/... · dai.ly/...", hosts: ["dailymotion.com", "dai.ly"], player: "dailymotion" },
  streamable: { id: "streamable", label: "Streamable", placeholder: "streamable.com/abc123", hosts: ["streamable.com"], player: "streamable" },
  kick: { id: "kick", label: "Kick", placeholder: "kick.com/canal · VOD/clip también se importa", hosts: ["kick.com"], player: "kick" },
  reddit: { id: "reddit", label: "Reddit", placeholder: "reddit.com/... · redd.it/...", hosts: ["reddit.com", "redd.it"], player: "native" },
  pinterest: { id: "pinterest", label: "Pinterest", placeholder: "pinterest.com/pin/... · pin.it/...", hosts: ["pinterest.com", "pin.it"], player: "native" },
  snapchat: { id: "snapchat", label: "Snapchat", placeholder: "snapchat.com/...", hosts: ["snapchat.com"], player: "native" },
};

function hostnameMatches(hostname: string, allowedHost: string) {
  return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
}

function normalizeUrl(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    const isHttp = url.protocol === "http:";
    const isHttps = url.protocol === "https:";
    const validPort = !url.port || (isHttp && url.port === "80") || (isHttps && url.port === "443");
    if ((!isHttp && !isHttps) || url.username || url.password || !url.hostname || !validPort || url.toString().length > 2_048) return null;
    return url;
  } catch {
    return null;
  }
}

function hasMeaningfulProviderPath(provider: PreviewProviderId, url: URL) {
  const path = url.pathname;
  const host = url.hostname.toLowerCase();
  switch (provider) {
    case "youtube":
      return host.endsWith("youtu.be") ? path.split("/").filter(Boolean).length >= 1 : Boolean(url.searchParams.get("v")) || /\/(?:shorts|embed|live)\/[A-Za-z0-9_-]{6,}/.test(path);
    case "facebook":
      return host.endsWith("fb.watch") || /\/(?:watch|videos|reel|share)\b/i.test(path) || Boolean(url.searchParams.get("v"));
    case "instagram":
      return /^\/(?:reel|reels|p|tv)\/[^/]+/i.test(path);
    case "tiktok":
      return /\/video\/\d+/i.test(path) || host.startsWith("vm.") || host.startsWith("vt.");
    case "vimeo":
      return /\/(?:video\/)?\d+/.test(path);
    case "x":
      return host === "t.co" || /\/status\/\d+/i.test(path);
    case "twitch":
      return host.startsWith("clips.") || /\/videos\/\d+/i.test(path) || path.split("/").filter(Boolean).length >= 1;
    case "dailymotion":
      return /\/video\/[A-Za-z0-9]+/i.test(path) || (host.endsWith("dai.ly") && path.length > 1);
    default:
      return path.split("/").filter(Boolean).length >= 1;
  }
}

export function isPreviewProviderId(value: string): value is PreviewProviderId {
  return (PREVIEW_PROVIDER_IDS as readonly string[]).includes(value);
}

export function getPreviewProvider(provider: PreviewProviderId) {
  return providers[provider];
}

export function previewProviderList() {
  return PREVIEW_PROVIDER_IDS.map((id) => providers[id]);
}

export function parsePreviewProviderUrl(provider: PreviewProviderId, value: string) {
  const url = normalizeUrl(value);
  if (!url) return null;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const spec = providers[provider];
  if (!spec.hosts.some((allowedHost) => hostnameMatches(hostname, allowedHost))) return null;
  if (!hasMeaningfulProviderPath(provider, url)) return null;
  return url.toString();
}

export function parseDirectVideoUrl(value: string) {
  return normalizeUrl(value)?.toString() ?? null;
}

function youtubeId(url: URL) {
  if (url.hostname.endsWith("youtu.be")) return url.pathname.split("/").filter(Boolean)[0] ?? null;
  return url.searchParams.get("v") ?? url.pathname.match(/\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{6,})/)?.[1] ?? null;
}

export function buildPreviewProviderEmbed(
  provider: PreviewProviderId,
  normalizedUrl: string,
  parentHostname: string
): { src: string; title: string } | null {
  const url = new URL(normalizedUrl);
  switch (provider) {
    case "youtube": {
      const id = youtubeId(url);
      return id ? { src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?controls=1&playsinline=1&rel=0`, title: "Reproductor de YouTube" } : null;
    }
    case "facebook":
      return { src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(normalizedUrl)}&show_text=false&autoplay=false`, title: "Reproductor de Facebook" };
    case "instagram": {
      const match = url.pathname.match(/^\/(reel|reels|p|tv)\/([^/]+)/i);
      if (!match) return null;
      const kind = match[1]!.toLowerCase() === "reels" ? "reel" : match[1]!.toLowerCase();
      return { src: `https://www.instagram.com/${kind}/${encodeURIComponent(match[2]!)}/embed/`, title: "Reproductor de Instagram" };
    }
    case "tiktok": {
      const id = url.pathname.match(/\/video\/(\d+)/)?.[1];
      return id ? { src: `https://www.tiktok.com/player/v1/${id}?autoplay=0&controls=1`, title: "Reproductor de TikTok" } : null;
    }
    case "vimeo": {
      const id = url.pathname.match(/\/(?:video\/)?(\d+)/)?.[1];
      return id ? { src: `https://player.vimeo.com/video/${id}?autoplay=0`, title: "Reproductor de Vimeo" } : null;
    }
    case "twitch": {
      const vod = url.pathname.match(/\/videos\/(\d+)/)?.[1];
      if (vod) return { src: `https://player.twitch.tv/?video=v${vod}&parent=${encodeURIComponent(parentHostname)}&autoplay=false`, title: "Reproductor de Twitch" };
      if (url.hostname.startsWith("clips.")) {
        const clip = url.pathname.split("/").filter(Boolean)[0];
        return clip ? { src: `https://clips.twitch.tv/embed?clip=${encodeURIComponent(clip)}&parent=${encodeURIComponent(parentHostname)}`, title: "Clip de Twitch" } : null;
      }
      return null;
    }
    case "dailymotion": {
      const id = url.pathname.match(/\/video\/([A-Za-z0-9]+)/)?.[1] ?? (url.hostname.endsWith("dai.ly") ? url.pathname.split("/").filter(Boolean)[0] : null);
      return id ? { src: `https://geo.dailymotion.com/player.html?video=${encodeURIComponent(id)}`, title: "Reproductor de Dailymotion" } : null;
    }
    case "streamable": {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? { src: `https://streamable.com/e/${encodeURIComponent(id)}`, title: "Reproductor de Streamable" } : null;
    }
    case "kick": {
      const segments = url.pathname.split("/").filter(Boolean);
      return segments.length === 1
        ? { src: `https://player.kick.com/${encodeURIComponent(segments[0]!)}`, title: "Reproductor en vivo de Kick" }
        : null;
    }
    case "x":
    case "reddit":
    case "pinterest":
    case "snapchat":
      return null;
  }
}
