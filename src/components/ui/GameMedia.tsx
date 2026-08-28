import Image from "next/image";

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
};

export default function GameMedia({
  src,
  alt,
  sizes,
  priority = false,
  variant = "cover",
  fallbackClassName,
}: GameMediaProps) {
  if (src) {
    const variantClass =
      variant === "hero"
        ? styles.heroImage
        : styles.coverImage;

    return (
      <Image
        key={src}
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={`${styles.image} ${variantClass}`}
      />
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
