import Image from "next/image";
import type { CSSProperties } from "react";

import {
  normalizeGameImageViewport,
} from "@/lib/media/image-viewport";
import type { GameImageViewport } from "@/types/game";

import styles from "./GameMedia.module.css";

type GameMediaVariant =
  | "cover"
  | "hero";

type GameMediaProps = {
  src?: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  variant?: GameMediaVariant;
  fallbackClassName?: string;
  viewport?: GameImageViewport;
  imageClassName?: string;
};

export default function GameMedia({
  src,
  alt,
  sizes,
  priority = false,
  variant = "cover",
  fallbackClassName,
  viewport,
  imageClassName,
}: GameMediaProps) {
  if (src) {
    const variantClass =
      variant === "hero"
        ? styles.heroImage
        : styles.coverImage;
    const framed = normalizeGameImageViewport(viewport);
    const position = `${(framed.x * 100).toFixed(2)}% ${(framed.y * 100).toFixed(2)}%`;
    const frameStyle = {
      "--game-image-zoom": framed.zoom,
      "--game-image-position": position,
    } as CSSProperties;

    return (
      <span className={styles.frame} style={frameStyle}>
        <span className={styles.viewportLayer}>
          <Image
            key={src}
            src={src}
            alt={alt}
            fill
            priority={priority}
            sizes={sizes}
            className={`${styles.image} ${variantClass} ${imageClassName ?? ""}`}
          />
        </span>
      </span>
    );
  }

  return (
    <div
      className={`${styles.fallback} ${
        fallbackClassName ?? ""
      }`}
      aria-hidden="true"
    />
  );
}
