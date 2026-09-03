import type { Metadata } from "next";

import { getPublicSiteConfig } from "@/lib/site/public-site-config";

import styles from "./admin.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPublicSiteConfig();

  return {
    title: "Administración privada",
    description:
      `Panel privado de administración de ${config.name}.`,
    robots: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
      noimageindex: true,
    },
    referrer: "no-referrer",
  };
}

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={styles.adminRoot}
      style={{
        background:
          "radial-gradient(900px 460px at 82% -12%, color-mix(in srgb, var(--brand) 8%, transparent), transparent 68%), color-mix(in srgb, var(--background) 18%, #05080d)",
      }}
    >
      {children}
    </div>
  );
}
