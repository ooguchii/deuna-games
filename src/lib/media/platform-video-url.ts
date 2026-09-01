export type SupportedVideoPlatform =
  | "youtube"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "vimeo"
  | "x"
  | "twitch"
  | "dailymotion"
  | "streamable"
  | "kick";

export type SupportedPlatformVideoUrl = {
  platform: SupportedVideoPlatform;
  platformLabel: string;
  hostname: string;
  url: string;
};

type PlatformRule = {
  platform: SupportedVideoPlatform;
  label: string;
  hosts: readonly string[];
};

const platformRules: readonly PlatformRule[] = [
  {
    platform: "youtube",
    label: "YouTube",
    hosts: [
      "youtube.com",
      "youtu.be",
      "youtube-nocookie.com",
    ],
  },
  {
    platform: "facebook",
    label: "Facebook",
    hosts: ["facebook.com", "fb.watch"],
  },
  {
    platform: "instagram",
    label: "Instagram",
    hosts: ["instagram.com"],
  },
  {
    platform: "tiktok",
    label: "TikTok",
    hosts: ["tiktok.com"],
  },
  {
    platform: "vimeo",
    label: "Vimeo",
    hosts: ["vimeo.com"],
  },
  {
    platform: "x",
    label: "X / Twitter",
    hosts: ["x.com", "twitter.com"],
  },
  {
    platform: "twitch",
    label: "Twitch",
    hosts: ["twitch.tv"],
  },
  {
    platform: "dailymotion",
    label: "Dailymotion",
    hosts: ["dailymotion.com", "dai.ly"],
  },
  {
    platform: "streamable",
    label: "Streamable",
    hosts: ["streamable.com"],
  },
  {
    platform: "kick",
    label: "Kick",
    hosts: ["kick.com"],
  },
] as const;

function cleanHostname(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function hostnameMatches(
  hostname: string,
  allowedHost: string
) {
  return (
    hostname === allowedHost ||
    hostname.endsWith(`.${allowedHost}`)
  );
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

export function parseSupportedPlatformVideoUrl(
  value: string
): SupportedPlatformVideoUrl | null {
  let parsed: URL;

  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }

  if (
    !protocolAndPortAllowed(parsed) ||
    parsed.username ||
    parsed.password ||
    !parsed.hostname ||
    parsed.toString().length > 2_048
  ) {
    return null;
  }

  const hostname = cleanHostname(parsed.hostname);
  const rule = platformRules.find(({ hosts }) =>
    hosts.some((allowedHost) =>
      hostnameMatches(hostname, allowedHost)
    )
  );

  if (!rule) return null;

  // Las plataformas públicas soportadas sirven su contenido por HTTPS.
  // Normalizar enlaces http:// históricos evita que un link válido falle
  // antes de llegar al extractor y mantiene la importación cifrada.
  parsed.protocol = "https:";
  parsed.port = "";

  return {
    platform: rule.platform,
    platformLabel: rule.label,
    hostname,
    url: parsed.toString(),
  };
}

export function supportedPlatformLabels() {
  return platformRules.map((rule) => rule.label);
}
