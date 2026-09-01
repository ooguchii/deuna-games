"use client";

import type { CSSProperties, ReactNode } from "react";
import { usePathname } from "next/navigation";

import {
  getSiteBackgroundAssets,
  resolveBackgroundPage,
  type SiteBackgroundAsset,
  type SiteBackgroundMap,
} from "@/lib/site/backgrounds";

import styles from "./PublicPageBackground.module.css";

type PublicPageBackgroundProps = {
  children: ReactNode;
  brandColor: string;
  customAssets?: SiteBackgroundAsset[];
  pageBackgrounds?: SiteBackgroundMap;
};

export default function PublicPageBackground({
  children,
  brandColor,
  customAssets = [],
  pageBackgrounds = {},
}: PublicPageBackgroundProps) {
  const pathname = usePathname();
  const page = resolveBackgroundPage(pathname);

  if (!page) return <>{children}</>;

  const setting = pageBackgrounds[page];

  if (!setting?.assetId) return <>{children}</>;

  const asset = getSiteBackgroundAssets(customAssets).find(
    (candidate) => candidate.id === setting.assetId
  );

  if (!asset) return <>{children}</>;

  const tintColor =
    setting.colorMode === "custom"
      ? setting.customColor
      : brandColor;
  const tintOpacity = Math.min(
    1,
    Math.max(0, setting.tintOpacity / 100)
  );

  return (
    <div className={styles.root}>
      <div className={styles.background} aria-hidden="true">
        <div
          className={styles.image}
          style={{
            backgroundImage: `url(${JSON.stringify(asset.image)})`,
          }}
        />
        <div
          className={styles.tint}
          style={{
            backgroundColor: tintColor,
            opacity: tintOpacity,
          } as CSSProperties}
        />
        <div className={styles.shade} />
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
