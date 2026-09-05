"use client";

import type { CSSProperties, ReactNode } from "react";
import { usePathname } from "next/navigation";

import {
  getSiteBackgroundAssets,
  resolveBackgroundPage,
  resolveBackgroundSetting,
  type SiteBackgroundAsset,
  type SiteBackgroundMap,
} from "@/lib/site/backgrounds";

import styles from "./PublicPageBackground.module.css";

export type PublicPageBackgroundProps = {
  children: ReactNode;
  brandColor: string;
  customAssets?: SiteBackgroundAsset[];
  pageBackgrounds?: SiteBackgroundMap;
  previewPathname?: string;
};

export default function PublicPageBackground({
  children,
  brandColor,
  customAssets = [],
  pageBackgrounds = {},
  previewPathname,
}: PublicPageBackgroundProps) {
  const pathname = usePathname();
  const page = resolveBackgroundPage(previewPathname ?? pathname);

  if (!page) return <>{children}</>;

  const storedSetting = pageBackgrounds[page];

  if (!storedSetting?.assetId) return <>{children}</>;

  const setting = resolveBackgroundSetting(
    storedSetting,
    brandColor
  );
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
  const imageOpacity = Math.min(
    1,
    Math.max(0.2, setting.imageOpacity / 100)
  );
  const shadeOpacity = Math.min(
    1,
    Math.max(0, setting.shadeOpacity / 100)
  );
  const scale = 1.015 + setting.blur / 350;

  return (
    <div className={styles.root}>
      <div className={styles.background} aria-hidden="true">
        <div
          className={styles.image}
          style={{
            backgroundImage: `url(${JSON.stringify(asset.image)})`,
            opacity: imageOpacity,
            filter: `brightness(${setting.brightness}%) saturate(${setting.saturation}%) contrast(${setting.contrast}%) blur(${setting.blur}px)`,
            transform: `scale(${scale.toFixed(3)})`,
          }}
        />
        <div
          className={styles.tint}
          style={{
            backgroundColor: tintColor,
            opacity: tintOpacity,
          } as CSSProperties}
        />
        <div
          className={styles.shade}
          style={{ opacity: shadeOpacity }}
        />
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
