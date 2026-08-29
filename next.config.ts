import type { NextConfig } from "next";

const isDev =
  process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${
    isDev ? " 'unsafe-eval'" : ""
  }`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  `connect-src 'self'${
    isDev ? " ws: wss:" : ""
  }`,
  "media-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "Referrer-Policy",
    value: "no-referrer",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-XSS-Protection",
    value: "0",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-site",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
] as const;

const privateAdminHeaders = [
  {
    key: "Cache-Control",
    value:
      "private, no-store, no-cache, max-age=0, must-revalidate",
  },
  {
    key: "X-Robots-Tag",
    value:
      "noindex, nofollow, noarchive, nosnippet, noimageindex",
  },
] as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,

  /*
   * Genera un runtime mínimo para producción.
   * El servidor público NO necesita recibir src/, tools/,
   * .git, reportes locales ni todo node_modules.
   */
  output: "standalone",

  /*
   * No publicar source maps del navegador.
   * El valor por defecto ya es false, queda explícito
   * para que no se habilite accidentalmente.
   */
  productionBrowserSourceMaps: false,

  images: {
    formats: [
      "image/avif",
      "image/webp",
    ],
  },

  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [...privateAdminHeaders],
      },
      {
        source: "/api/admin/:path*",
        headers: [...privateAdminHeaders],
      },
      {
        source: "/(.*)",
        headers: [...securityHeaders],
      },
    ];
  },
};

export default nextConfig;
