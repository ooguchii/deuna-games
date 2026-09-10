"use client";

import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Monitor,
  Star,
} from "lucide-react";
import type {
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import GameMedia from "@/components/ui/GameMedia";
import HoverPreviewMedia from "@/components/ui/HoverPreviewMedia";
import {
  resolveGameCardPresentation,
} from "@/lib/media/game-card-presentation";
import type { Game } from "@/types/game";

import styles from "./UniversalGameCard.module.css";
import presentationStyles from "./UniversalGameCardPresentation.module.css";

export type UniversalGameCardVariant =
  | "standard"
  | "recent"
  | "lowSpec"
  | "catalog";

export type UniversalGameCardProps = {
  game: Game;
  variant?: UniversalGameCardVariant;
  overlayAction?: ReactNode;
  supplementalContent?: ReactNode;
};

type PendingTilt = {
  node: HTMLElement;
  clientX: number;
  clientY: number;
};

const PREVIEW_DELAY_MS = 1000;
const FINE_HOVER_MEDIA = "(hover: hover) and (pointer: fine)";
const REDUCED_MOTION_MEDIA = "(prefers-reduced-motion: reduce)";

const fallbackClassBySlug: Record<string, string> = {
  "god-of-war-ragnarok": "godOfWar",
  "elden-ring": "eldenRing",
  "forza-horizon-5": "forza",
  "resident-evil-4": "residentEvil",
  "hogwarts-legacy": "hogwarts",
  "cyberpunk-2077": "cyberpunk",
  "baldurs-gate-3": "baldursGate",
  "red-dead-redemption-2": "redDead",
  "lies-of-p": "liesOfP",
  "armored-core-vi": "armoredCore",
  "stellar-blade": "stellarBlade",
  "palworld": "palworld",
  "enshrouded": "enshrouded",
  "helldivers-2": "helldivers",
  "the-talos-principle-2": "talos",
  "minecraft-java-edition": "minecraft",
  "left-4-dead-2": "left4Dead",
  "gta-san-andreas": "gta",
  "terraria": "terraria",
  "half-life-2": "halfLife",
  "portal-2": "portal",
  "stardew-valley": "stardew",
};

function getMediaBadge(
  game: Game,
  variant: UniversalGameCardVariant
) {
  if (variant === "recent") {
    return { label: "NUEVO", tone: "brand" as const };
  }
  if (variant === "catalog") {
    return { label: game.category, tone: "brand" as const };
  }
  return null;
}

function resetTilt(node: HTMLElement) {
  node.style.setProperty("--tilt-x", "0deg");
  node.style.setProperty("--tilt-y", "0deg");
  node.style.setProperty("--pointer-x", "50%");
  node.style.setProperty("--pointer-y", "50%");
  node.style.setProperty("--image-x", "0px");
  node.style.setProperty("--image-y", "0px");
}

function applyTilt(
  node: HTMLElement,
  clientX: number,
  clientY: number,
  rect: DOMRect
) {
  const x = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  const y = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
  node.style.setProperty("--tilt-x", `${((0.5 - y) * 7).toFixed(2)}deg`);
  node.style.setProperty("--tilt-y", `${((x - 0.5) * 8).toFixed(2)}deg`);
  node.style.setProperty("--pointer-x", `${(x * 100).toFixed(1)}%`);
  node.style.setProperty("--pointer-y", `${(y * 100).toFixed(1)}%`);
  node.style.setProperty("--image-x", `${((x - 0.5) * -8).toFixed(2)}px`);
  node.style.setProperty("--image-y", `${((y - 0.5) * -6).toFixed(2)}px`);
}

function Rating({ game }: { game: Game }) {
  return (
    <div className={styles.rating}>
      <Star size={17} fill="currentColor" aria-hidden="true" />
      <strong>{game.rating ?? "—"}</strong>
      {game.reviews && <span>({game.reviews})</span>}
    </div>
  );
}

function LowSpecDetails({ game }: { game: Game }) {
  const requirements = game.requirements;
  const minimum = requirements?.minimum;
  const ram = requirements?.ram ?? minimum?.ram ?? "—";
  const graphics = requirements?.graphics ?? minimum?.graphics ?? "—";
  const system = requirements?.system ?? minimum?.system ?? "—";

  return (
    <>
      <span className={styles.lowSpecBadge}>BAJOS RECURSOS</span>
      <div className={styles.requirements}>
        <div><span className={styles.requirementIcon}>R</span><p>RAM: <strong>{ram}</strong></p></div>
        <div><span className={styles.requirementIcon}>G</span><p>Gráfica: <strong>{graphics}</strong></p></div>
        <div><span className={styles.requirementIcon}>SO</span><p>Sistema: <strong>{system}</strong></p></div>
      </div>
    </>
  );
}

export default function UniversalGameCardBase({
  game,
  variant = "standard",
  overlayAction,
  supplementalContent,
}: UniversalGameCardProps) {
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tiltFrame = useRef<number | null>(null);
  const pendingTilt = useRef<PendingTilt | null>(null);
  const cardRect = useRef<DOMRect | null>(null);
  const pointerEffectsEnabled = useRef(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const presentation = resolveGameCardPresentation(game);
  const cardMode = presentation.card.mode;
  const preview = presentation.card.preview;
  const fallbackClass = fallbackClassBySlug[game.slug];
  const mediaBadge = getMediaBadge(game, variant);
  const isCatalog = variant === "catalog";
  const isRecent = variant === "recent";
  const isLowSpec = variant === "lowSpec";
  const variantClass = styles[
    `variant${variant[0].toUpperCase()}${variant.slice(1)}`
  ];

  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION_MEDIA);
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  function clearPreview() {
    if (previewTimer.current) {
      clearTimeout(previewTimer.current);
      previewTimer.current = null;
    }
    setPreviewActive(false);
  }

  function revealDetail(immediateVideo: boolean) {
    setDetailVisible(true);
    if (!preview || reducedMotion || cardMode === "image") return;

    if (cardMode === "video" || immediateVideo) {
      setPreviewActive(true);
      return;
    }

    if (!previewTimer.current) {
      previewTimer.current = setTimeout(() => {
        previewTimer.current = null;
        setPreviewActive(true);
      }, PREVIEW_DELAY_MS);
    }
  }

  function hideDetail() {
    setDetailVisible(false);
    clearPreview();
  }

  function startCard(event: ReactPointerEvent<HTMLElement>) {
    const finePointer =
      event.pointerType !== "touch" &&
      window.matchMedia(FINE_HOVER_MEDIA).matches;

    pointerEffectsEnabled.current = finePointer && !reducedMotion;
    if (pointerEffectsEnabled.current) {
      cardRect.current = event.currentTarget.getBoundingClientRect();
    }
    if (finePointer) revealDetail(false);
  }

  function scheduleTilt(event: ReactPointerEvent<HTMLElement>) {
    if (!pointerEffectsEnabled.current) return;
    pendingTilt.current = {
      node: event.currentTarget,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    if (tiltFrame.current !== null) return;

    tiltFrame.current = requestAnimationFrame(() => {
      tiltFrame.current = null;
      const pending = pendingTilt.current;
      const rect = cardRect.current;
      pendingTilt.current = null;
      if (pending && rect) {
        applyTilt(pending.node, pending.clientX, pending.clientY, rect);
      }
    });
  }

  function stopCard(event: ReactPointerEvent<HTMLElement>) {
    if (tiltFrame.current !== null) cancelAnimationFrame(tiltFrame.current);
    tiltFrame.current = null;
    pendingTilt.current = null;
    cardRect.current = null;
    pointerEffectsEnabled.current = false;
    resetTilt(event.currentTarget);
    hideDetail();
  }

  function focusCard() {
    revealDetail(true);
  }

  function blurCard(event: ReactFocusEvent<HTMLElement>) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    hideDetail();
  }

  useEffect(() => () => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    if (tiltFrame.current !== null) cancelAnimationFrame(tiltFrame.current);
  }, []);

  const videoActive = Boolean(
    detailVisible &&
    previewActive &&
    !reducedMotion &&
    preview &&
    cardMode !== "image"
  );

  return (
    <article
      className={`${styles.card} ${presentationStyles.shell} ${variantClass}`}
      data-card-variant={variant}
      data-detail-visible={detailVisible ? "true" : "false"}
      data-cover-source={presentation.cover.source}
      onPointerEnter={startCard}
      onPointerMove={scheduleTilt}
      onPointerLeave={stopCard}
      onPointerCancel={stopCard}
      onFocusCapture={focusCard}
      onBlurCapture={blurCard}
      style={{
        "--tilt-x": "0deg",
        "--tilt-y": "0deg",
        "--pointer-x": "50%",
        "--pointer-y": "50%",
        "--image-x": "0px",
        "--image-y": "0px",
      } as CSSProperties}
    >
      <Link
        href={`/juegos/${game.slug}`}
        className={`${styles.link} ${presentationStyles.link}`}
        aria-label={`Ver ${game.title}`}
      >
        <div className={presentationStyles.coverFace} aria-hidden={detailVisible ? "true" : undefined}>
          <GameMedia
            src={presentation.cover.image}
            alt={detailVisible ? "" : presentation.cover.alt}
            viewport={presentation.cover.viewport}
            sizes="(max-width: 560px) 82vw, (max-width: 900px) 48vw, (max-width: 1250px) 30vw, 20vw"
            fallbackClassName={fallbackClass ? styles[fallbackClass] : undefined}
          />
          <div className={presentationStyles.coverShade} aria-hidden="true" />
        </div>

        <div className={presentationStyles.detailFace} aria-hidden={!detailVisible ? "true" : undefined}>
          <div className={`${styles.media} ${presentationStyles.detailMedia}`}>
            <HoverPreviewMedia
              imageSrc={presentation.card.image}
              imageAlt={detailVisible ? presentation.card.alt : ""}
              imageViewport={presentation.card.viewport}
              previewClip={preview?.src}
              previewViewport={preview?.viewport}
              active={videoActive}
              sizes="(max-width: 560px) 82vw, (max-width: 900px) 48vw, (max-width: 1250px) 30vw, 20vw"
              fallbackClassName={fallbackClass ? styles[fallbackClass] : undefined}
            />
            <div className={styles.mediaOverlay} aria-hidden="true" />
            {mediaBadge && (
              <span className={`${styles.mediaBadge} ${mediaBadge.tone === "brand" ? styles.mediaBadgeBrand : ""}`}>
                {mediaBadge.label}
              </span>
            )}
            <Monitor size={18} className={styles.platform} aria-hidden="true" />
          </div>

          <div className={`${styles.content} ${presentationStyles.detailContent}`}>
            <div className={styles.titleRow}>
              <h3>{game.title}</h3>
              {isRecent && game.version && <span className={styles.version}>{game.version}</span>}
              {isCatalog && <ChevronRight size={17} aria-hidden="true" />}
            </div>

            {isCatalog && <p className={styles.description}>{game.description}</p>}
            {isLowSpec && <LowSpecDetails game={game} />}
            <Rating game={game} />

            {isRecent && game.addedAt && (
              <div className={styles.date}>
                <CalendarDays size={15} aria-hidden="true" />
                <span>Añadido el {game.addedAt}</span>
              </div>
            )}
            {supplementalContent}
          </div>
        </div>
      </Link>
      {overlayAction}
    </article>
  );
}
