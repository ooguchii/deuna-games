"use client";

import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import styles from "./CardCarousel.module.css";

type CarouselStyle = CSSProperties & {
  "--items-desktop": number;
};

type CardCarouselProps = {
  children: ReactNode;
  ariaLabel: string;
  itemsDesktop?: number;
};

export default function CardCarousel({
  children,
  ariaLabel,
  itemsDesktop = 5,
}: CardCarouselProps) {
  const trackRef =
    useRef<HTMLDivElement>(null);

  const [canScrollLeft, setCanScrollLeft] =
    useState(false);

  const [canScrollRight, setCanScrollRight] =
    useState(false);

  const updateControls =
    useCallback(() => {
      const track = trackRef.current;

      if (!track) {
        return;
      }

      const maxScroll =
        track.scrollWidth -
        track.clientWidth;

      setCanScrollLeft(
        track.scrollLeft > 2
      );

      setCanScrollRight(
        track.scrollLeft <
          maxScroll - 2
      );
    }, []);

  useEffect(() => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    updateControls();

    const observer =
      new ResizeObserver(() => {
        updateControls();
      });

    observer.observe(track);

    track.addEventListener(
      "scroll",
      updateControls,
      {
        passive: true,
      }
    );

    return () => {
      observer.disconnect();

      track.removeEventListener(
        "scroll",
        updateControls
      );
    };
  }, [updateControls]);

  function getScrollAmount() {
    const track = trackRef.current;

    if (!track) {
      return 0;
    }

    const firstItem =
      track.firstElementChild as
        | HTMLElement
        | null;

    if (!firstItem) {
      return track.clientWidth;
    }

    const style =
      window.getComputedStyle(track);

    const gap =
      Number.parseFloat(style.gap) || 0;

    return (
      firstItem.getBoundingClientRect()
        .width + gap
    );
  }

  function scroll(
    direction: "left" | "right"
  ) {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    const amount =
      getScrollAmount();

    track.scrollBy({
      left:
        direction === "right"
          ? amount
          : -amount,

      behavior: "smooth",
    });
  }

  function handleKeyboard(
    event: React.KeyboardEvent<HTMLDivElement>
  ) {
    if (event.key === "ArrowRight") {
      event.preventDefault();

      scroll("right");
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();

      scroll("left");
    }
  }

  const carouselStyle: CarouselStyle = {
    "--items-desktop":
      itemsDesktop,
  };

  return (
    <div
      className={styles.carousel}
      style={carouselStyle}
      role="region"
      aria-roledescription="carrusel"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowLeft}`}
        aria-label="Ver anteriores"
        disabled={!canScrollLeft}
        onClick={() =>
          scroll("left")
        }
      >
        <ChevronLeft
          size={23}
          aria-hidden="true"
        />
      </button>

      <div
        ref={trackRef}
        className={styles.track}
        tabIndex={0}
        aria-live="off"
        aria-label={`${ariaLabel}. Usa las flechas izquierda y derecha del teclado para navegar.`}
        onKeyDown={handleKeyboard}
      >
        {children}
      </div>

      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowRight}`}
        aria-label="Ver siguientes"
        disabled={!canScrollRight}
        onClick={() =>
          scroll("right")
        }
      >
        <ChevronRight
          size={23}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
