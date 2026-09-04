import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

function isPrivateIpv4(value: string) {
  const octets = value.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  if (octets[0] === 10) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  return octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31;
}

const lanHost = process.env.DEUNA_LAN_HOST?.trim() ?? "";
const allowedDevOrigins = isDev && isPrivateIpv4(lanHost) ? [lanHost] : undefined;

const previewFrameOrigins = [
  "https://www.youtube-nocookie.com",
  "https://www.facebook.com",
  "https://www.instagram.com",
  "https://www.tiktok.com",
  "https://player.vimeo.com",
  "https://player.twitch.tv",
  "https://clips.twitch.tv",
  "https://geo.dailymotion.com",
  "https://streamable.com",
  "https://player.kick.com",
].join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "media-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  `frame-src ${previewFrameOrigins}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "0" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-site" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
] as const;

const privateAdminHeaders = [
  { key: "Cache-Control", value: "private, no-store, no-cache, max-age=0, must-revalidate" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet, noimageindex" },
] as const;

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  experimental: { useTypeScriptCli: false },
  ...(allowedDevOrigins ? { allowedDevOrigins } : {}),
  output: "standalone",
  productionBrowserSourceMaps: false,
  images: { formats: ["image/avif", "image/webp"] },
  async headers() {
    return [
      { source: "/admin/:path*", headers: [...privateAdminHeaders] },
      { source: "/api/admin/:path*", headers: [...privateAdminHeaders] },
      { source: "/(.*)", headers: [...securityHeaders] },
    ];
  },
};

export default nextConfig;
