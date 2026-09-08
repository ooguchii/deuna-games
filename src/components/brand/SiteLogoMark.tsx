import type { CSSProperties } from "react";
import { Gamepad2 } from "lucide-react";

import {
  isSiteBrandLogoAsset,
  type SiteLogoColorMode,
} from "@/lib/site/logo";

import styles from "./SiteLogoMark.module.css";

type SiteLogoMarkProps = {
  size?: number;
  scale?: number;
  strokeWidth?: number;
  className?: string;
  asset?: string | null;
  color?: string;
  colorMode?: SiteLogoColorMode;
};

/**
 * Símbolo gráfico único de la marca.
 *
 * Sin override toma la identidad publicada desde las variables del RootLayout.
 * Admin puede pasar asset/color/modo para previsualizar el borrador sin
 * contaminar la web pública antes de publicar.
 */
export default function SiteLogoMark({
  size = 26,
  scale,
  strokeWidth = 2,
  className,
  asset,
  color,
  colorMode,
}: SiteLogoMarkProps) {
  const hasOverride = asset !== undefined;
  const safeAsset = asset && isSiteBrandLogoAsset(asset)
    ? asset
    : null;
  const style = {
    "--site-logo-size": `${size}px`,
    ...(scale !== undefined ? { "--site-logo-scale": scale / 100 } : {}),
    ...(color ? { "--site-logo-color": color } : {}),
    ...(safeAsset
      ? { "--site-logo-image": `url("${safeAsset}")` }
      : {}),
  } as CSSProperties;

  return (
    <span
      className={`${styles.root}${className ? ` ${className}` : ""}`}
      style={style}
      data-logo-override={
        hasOverride
          ? safeAsset
            ? "custom"
            : "default"
          : undefined
      }
      data-logo-color-mode={
        hasOverride && safeAsset
          ? colorMode ?? "brand"
          : undefined
      }
      aria-hidden="true"
    >
      <Gamepad2
        size={size}
        className={styles.fallback}
        strokeWidth={strokeWidth}
      />
      <span className={styles.customColorized} />
      <span className={styles.customOriginal} />
    </span>
  );
}
