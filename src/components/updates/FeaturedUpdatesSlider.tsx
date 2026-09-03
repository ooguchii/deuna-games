"use client";

import Link from "next/link";

import {
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";

import {
  PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  formatUpdateDate,
} from "@/lib/updates/catalog";
import GameMedia from "@/components/ui/GameMedia";

import type {
  ResolvedGameUpdate,
} from "@/types/update";

import styles from "./FeaturedUpdatesSlider.module.css";

type FeaturedUpdatesSliderProps = {
  updates:
    ResolvedGameUpdate[];
};

const AUTOPLAY_MS = 6500;
const SWIPE_THRESHOLD = 44;

export default function FeaturedUpdatesSlider({
  updates,
}: FeaturedUpdatesSliderProps) {
  const slides =
    useMemo(
      () =>
        updates.slice(
          0,
          5
        ),
      [updates]
    );

  const [
    activeIndex,
    setActiveIndex,
  ] = useState(0);

  const [
    paused,
    setPaused,
  ] = useState(false);

  const pointerStartX =
    useRef<
      number | null
    >(null);

  const safeActiveIndex =
    slides.length === 0
      ? 0
      : activeIndex %
        slides.length;

  const goTo =
    useCallback(
      (nextIndex: number) => {
        if (
          slides.length === 0
        ) {
          return;
        }

        const normalized =
          (
            nextIndex +
            slides.length
          ) %
          slides.length;

        setActiveIndex(
          normalized
        );
      },
      [slides.length]
    );

  const goNext =
    useCallback(
      () => {
        goTo(
          safeActiveIndex + 1
        );
      },
      [
        goTo,
        safeActiveIndex,
      ]
    );

  const goPrevious =
    useCallback(
      () => {
        goTo(
          safeActiveIndex - 1
        );
      },
      [
        goTo,
        safeActiveIndex,
      ]
    );

  useEffect(() => {
    if (
      paused ||
      slides.length < 2
    ) {
      return;
    }

    const media =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      );

    if (media.matches) {
      return;
    }

    const timer =
      window.setTimeout(
        goNext,
        AUTOPLAY_MS
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [
    goNext,
    paused,
    slides.length,
  ]);

  function handlePointerDown(
    event:
      PointerEvent<HTMLElement>
  ) {
    pointerStartX.current =
      event.clientX;
  }

  function handlePointerUp(
    event:
      PointerEvent<HTMLElement>
  ) {
    const start =
      pointerStartX.current;

    pointerStartX.current =
      null;

    if (
      start === null
    ) {
      return;
    }

    const delta =
      event.clientX -
      start;

    if (
      Math.abs(delta) <
      SWIPE_THRESHOLD
    ) {
      return;
    }

    if (delta < 0) {
      goNext();
      return;
    }

    goPrevious();
  }

  if (
    slides.length === 0
  ) {
    return null;
  }

  return (
    <section
      className={
        styles.slider
      }
      aria-label="Actualizaciones destacadas"
      aria-roledescription="carrusel"
      onMouseEnter={() =>
        setPaused(true)
      }
      onMouseLeave={() =>
        setPaused(false)
      }
      onFocusCapture={() =>
        setPaused(true)
      }
      onBlurCapture={() =>
        setPaused(false)
      }
      onPointerDown={
        handlePointerDown
      }
      onPointerUp={
        handlePointerUp
      }
    >
      <div
        className={
          styles.slides
        }
      >
        {slides.map(
          (
            update,
            index
          ) => {
            const isActive =
              index ===
              safeActiveIndex;

            const heroSrc =
              update.game
                .heroImage;

            const coverSrc =
              update.game
                .coverImage;

            const backdropSrc =
              heroSrc ??
              coverSrc;

            const backdropViewport =
              heroSrc
                ? update.game
                    .imageMedia
                    ?.hero
                : update.game
                    .imageMedia
                    ?.card ??
                  update.game
                    .imageMedia
                    ?.cover;

            return (
              <article
                key={
                  update.id
                }
                className={`${styles.slide} ${
                  isActive
                    ? styles.active
                    : ""
                }`}
                aria-hidden={
                  !isActive
                }
              >
                <div
                  className={
                    styles.media
                  }
                  aria-hidden="true"
                >
                  {backdropSrc && (
                    <GameMedia
                      src={
                        backdropSrc
                      }
                      alt=""
                      priority={
                        index === 0
                      }
                      sizes="(max-width: 980px) 100vw, 58vw"
                      variant="hero"
                      viewport={
                        backdropViewport
                      }
                      imageClassName={
                        styles.backdrop
                      }
                    />
                  )}

                  {heroSrc && (
                    <GameMedia
                      src={
                        heroSrc
                      }
                      alt=""
                      priority={
                        index === 0
                      }
                      sizes="(max-width: 980px) 100vw, 58vw"
                      variant="hero"
                      viewport={
                        update.game
                          .imageMedia
                          ?.hero
                      }
                      imageClassName={
                        styles.heroArtwork
                      }
                    />
                  )}

                  {!heroSrc &&
                    coverSrc && (
                      <div
                        className={
                          styles.posterFrame
                        }
                      >
                        <GameMedia
                          src={
                            coverSrc
                          }
                          alt=""
                          priority={
                            index === 0
                          }
                          sizes="(max-width: 650px) 60vw, 34vw"
                          viewport={
                            update.game
                              .imageMedia
                              ?.cover
                          }
                          imageClassName={
                            styles.posterArtwork
                          }
                        />
                      </div>
                    )}

                  <div
                    className={
                      styles.mediaWash
                    }
                  />

                  <div
                    className={
                      styles.mediaVignette
                    }
                  />
                </div>

                <div
                  className={
                    styles.content
                  }
                >
                  <span
                    className={
                      styles.badge
                    }
                  >
                    ACTUALIZACIÓN DESTACADA
                  </span>

                  <div
                    className={
                      styles.heading
                    }
                  >
                    <h2>
                      {
                        update.game
                          .title
                      }
                    </h2>

                    <strong>
                      {
                        update.version
                      }
                    </strong>
                  </div>

                  <p>
                    {
                      update.summary
                    }
                  </p>

                  <div
                    className={
                      styles.meta
                    }
                  >
                    <span>
                      {formatUpdateDate(
                        update.publishedAt
                      )}
                    </span>

                    <span
                      aria-hidden="true"
                    >
                      •
                    </span>

                    <span>
                      PC
                    </span>
                  </div>

                  {update.downloadable && (
                    <Link
                      href={`/juegos/${update.game.slug}/descargar`}
                      className={
                        styles.download
                      }
                      tabIndex={
                        isActive
                          ? 0
                          : -1
                      }
                    >
                      Descargar
                      <Download
                        size={17}
                        aria-hidden="true"
                      />
                    </Link>
                  )}
                </div>
              </article>
            );
          }
        )}
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowLeft}`}
            onClick={
              goPrevious
            }
            aria-label="Actualización anterior"
          >
            <ChevronLeft
              size={20}
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            className={`${styles.arrow} ${styles.arrowRight}`}
            onClick={
              goNext
            }
            aria-label="Actualización siguiente"
          >
            <ChevronRight
              size={20}
              aria-hidden="true"
            />
          </button>

          <div
            className={
              styles.pagination
            }
          >
            <span
              className={
                styles.counter
              }
              aria-hidden="true"
            >
              {String(
                safeActiveIndex + 1
              ).padStart(
                2,
                "0"
              )}
              <em>/</em>
              {String(
                slides.length
              ).padStart(
                2,
                "0"
              )}
            </span>

            <div
              className={
                styles.dots
              }
              role="tablist"
              aria-label="Seleccionar actualización destacada"
            >
              {slides.map(
                (
                  update,
                  index
                ) => (
                  <button
                    key={
                      update.id
                    }
                    type="button"
                    className={
                      index ===
                      safeActiveIndex
                        ? styles.dotActive
                        : ""
                    }
                    onClick={() =>
                      goTo(
                        index
                      )
                    }
                    aria-label={`Mostrar ${update.game.title} ${update.version}`}
                    aria-selected={
                      index ===
                      safeActiveIndex
                    }
                    role="tab"
                  />
                )
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
