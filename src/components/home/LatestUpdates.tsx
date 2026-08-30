import Link from "next/link";

import {
  ChevronRight,
  RefreshCcw,
} from "lucide-react";

import GameMedia from "@/components/ui/GameMedia";
import {
  formatUpdateDate,
} from "@/lib/updates/catalog";
import type {
  ResolvedGameUpdate,
} from "@/types/update";

import styles from "./LatestUpdates.module.css";

const fallbackClassBySlug:
  Record<string, string> = {
    "elden-ring": "eldenRing",
    "palworld": "palworld",
    "stellar-blade":
      "stellarBlade",
  };

type LatestUpdatesProps = {
  updates: readonly ResolvedGameUpdate[];
};

export default function LatestUpdates({
  updates,
}: LatestUpdatesProps) {
  return (
    <section
      className={
        styles.section
      }
    >
      <div
        className={
          styles.header
        }
      >
        <h2>
          ÚLTIMAS{" "}
          <span>
            ACTUALIZACIONES
          </span>
        </h2>

        <Link href="/actualizaciones">
          Ver todas las actualizaciones
        </Link>
      </div>

      <div
        className={
          styles.grid
        }
      >
        {updates.map(
          (update) => {
            const fallbackClass =
              fallbackClassBySlug[
                update.game.slug
              ];

            return (
              <article
                className={
                  styles.card
                }
                key={
                  update.id
                }
              >
                <Link
                  href={`/juegos/${update.game.slug}`}
                  className={
                    styles.cardLink
                  }
                >
                  <div
                    className={
                      styles.image
                    }
                  >
                    <GameMedia
                      src={
                        update.game
                          .coverImage
                      }
                      alt={
                        update.game
                          .imageAlt
                      }
                      sizes="(max-width: 650px) 100vw, (max-width: 1150px) 240px, 13vw"
                      fallbackClassName={
                        fallbackClass
                          ? styles[
                              fallbackClass
                            ]
                          : undefined
                      }
                    />

                    <div
                      className={
                        styles.imageOverlay
                      }
                    />

                    <div
                      className={
                        styles.updateIcon
                      }
                    >
                      <RefreshCcw
                        size={19}
                      />
                    </div>

                    <span
                      className={
                        styles.badge
                      }
                    >
                      ACTUALIZADO
                    </span>
                  </div>

                  <div
                    className={
                      styles.content
                    }
                  >
                    <div
                      className={
                        styles.topRow
                      }
                    >
                      <span
                        className={
                          styles.date
                        }
                      >
                        {formatUpdateDate(
                          update.publishedAt
                        )}
                      </span>

                      <span
                        className={
                          styles.version
                        }
                      >
                        {
                          update.version
                        }
                      </span>
                    </div>

                    <h3>
                      {
                        update.game
                          .title
                      }
                    </h3>

                    <p>
                      {
                        update.summary
                      }
                    </p>

                    <span
                      className={
                        styles.details
                      }
                    >
                      Ver juego
                      <ChevronRight
                        size={16}
                      />
                    </span>
                  </div>
                </Link>
              </article>
            );
          }
        )}
      </div>
    </section>
  );
}
