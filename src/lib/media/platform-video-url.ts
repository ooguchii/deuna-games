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
  | "kick"
  | "reddit"
  | "rumble"
  | "odysee"
  | "bilibili"
  | "vk"
  | "imgur"
  | "pinterest"
  | "tumblr"
  | "snapchat"
  | "loom"
  | "wistia"
  | "nicovideo";

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
    hosts: ["youtube.com", "youtu.be", "youtube-nocookie.com"],
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
    hosts: ["x.com", "twitter.com", "t.co"],
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
  {
    platform: "reddit",
    label: "Reddit",
    hosts: ["reddit.com", "redd.it"],
  },
  {
    platform: "rumble",
    label: "Rumble",
    hosts: ["rumble.com"],
  },
  {
    platform: "odysee",
    label: "Odysee",
    hosts: ["odysee.com"],
  },
  {
    platform: "bilibili",
    label: "Bilibili",
    hosts: ["bilibili.com", "b23.tv"],
  },
  {
    platform: "vk",
    label: "VK",
    hosts: ["vk.com"],
  },
  {
    platform: "imgur",
    label: "Imgur",
    hosts: ["imgur.com"],
  },
  {
    platform: "pinterest",
    label: "Pinterest",
    hosts: ["pinterest.com", "pin.it"],
  },
  {
    platform: "tumblr",
    label: "Tumblr",
    hosts: ["tumblr.com"],
  },
  {
    platform: "snapchat",
    label: "Snapchat",
    hosts: ["snapchat.com"],
  },
  {
    platform: "loom",
    label: "Loom",
    hosts: ["loom.com"],
  },
  {
    platform: "wistia",
    label: "Wistia",
    hosts: ["wistia.com", "wistia.net"],
  },
  {
    platform: "nicovideo",
    label: "Niconico",
    hosts: ["nicovideo.jp", "nico.ms"],
  },
] as const;

function cleanHostname(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function hostnameMatches(hostname: string, allowedHost: string) {
  return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
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
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    !parsed.hostname ||
    (parsed.port && parsed.port !== "443") ||
    parsed.toString().length > 2_048
  ) {
    return null;
  }

  const hostname = cleanHostname(parsed.hostname);
  const rule = platformRules.find(({ hosts }) =>
    hosts.some((allowedHost) => hostnameMatches(hostname, allowedHost))
  );

  if (!rule) return null;

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
