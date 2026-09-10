#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from textwrap import dedent

EXPECTED_BASE = "218e0244e1673b92c9d750258cd81993692c47bd"
PATCH_NAME = "deuna-games-card-cover-post-audit.patch"

@dataclass(frozen=True)
class Replacement:
    path: str
    old: str
    new: str

def d(text: str) -> str:
    return dedent(text).lstrip("\n")

REPLACEMENTS: list[Replacement] = [
    Replacement(
        "src/lib/media/game-card-presentation.ts",
        d(r'''
        export function resolveGameCoverImage(game: Game) {
          const source = resolveGameCoverArtworkSource(game);
          return source === "custom"
            ? game.coverImage
            : resolveGameCardBaseImage(game) ?? game.coverImage;
        }

        export function resolveGameCardPresentation(
          game: Game
        ): GameCardPresentation {
          return {
            cover: {
              image: resolveGameCoverImage(game),
              viewport: game.imageMedia?.cover,
              alt:
                game.mediaAccessibility?.cover ??
                game.mediaAccessibility?.card ??
                game.imageAlt,
              source: resolveGameCoverArtworkSource(game),
            },
            card: {
              image: resolveGameCardBaseImage(game),
              viewport: game.imageMedia?.card,
              alt: game.mediaAccessibility?.card ?? game.imageAlt,
              mode: resolveGameDestinationMediaMode(game, "card"),
              preview: resolveGameCardPreview(game),
            },
          };
        }
        '''),
        d(r'''
        export function resolveGameCoverImage(game: Game) {
          const source = resolveGameCoverArtworkSource(game);
          return source === "custom"
            ? game.coverImage
            : resolveGameCardBaseImage(game) ?? game.coverImage;
        }

        export function resolveGameCoverAlt(game: Game) {
          return game.mediaAccessibility?.cover ?? game.imageAlt;
        }

        export function resolveGameCardAlt(game: Game) {
          return game.mediaAccessibility?.card ?? game.imageAlt;
        }

        export function resolveGameCardPresentation(
          game: Game
        ): GameCardPresentation {
          return {
            cover: {
              image: resolveGameCoverImage(game),
              viewport: game.imageMedia?.cover,
              alt: resolveGameCoverAlt(game),
              source: resolveGameCoverArtworkSource(game),
            },
            card: {
              image: resolveGameCardBaseImage(game),
              viewport: game.imageMedia?.card,
              alt: resolveGameCardAlt(game),
              mode: resolveGameDestinationMediaMode(game, "card"),
              preview: resolveGameCardPreview(game),
            },
          };
        }
        '''),
    ),
    Replacement(
        "src/components/ui/GameCoverMedia.tsx",
        'import { resolveGameCoverImage } from "@/lib/media/game-card-presentation";',
        d(r'''
        import {
          resolveGameCoverAlt,
          resolveGameCoverImage,
        } from "@/lib/media/game-card-presentation";
        ''').rstrip("\n"),
    ),
    Replacement(
        "src/components/ui/GameCoverMedia.tsx",
        '          alt={game.mediaAccessibility?.cover ?? game.imageAlt}',
        '          alt={resolveGameCoverAlt(game)}',
    ),
    Replacement(
        "src/lib/media/game-media-accessibility.ts",
        d(r'''
        import {
          resolveGameDestinationMediaMode,
        } from "@/lib/media/game-video-media";
        '''),
        d(r'''
        import {
          resolveGameCardBaseImage,
          resolveGameCoverImage,
        } from "@/lib/media/game-card-presentation";
        import {
          resolveGameGalleryItems,
        } from "@/lib/media/game-gallery-media";
        '''),
    ),
    Replacement(
        "src/lib/media/game-media-accessibility.ts",
        d(r'''
          const gallery = game.galleryMedia?.length
            ? game.galleryMedia
            : (game.screenshots ?? []).map((src) => ({
                kind: "image" as const,
                src,
              }));
          const labels = game.mediaAccessibility;
          const coverReady = !game.coverImage || Boolean(labels?.cover?.trim());
          const cardMode = resolveGameDestinationMediaMode(game, "card");
          const cardImage = cardMode === "video"
            ? undefined
            : game.cardImage ?? game.coverImage;
          const cardReady = !cardImage || Boolean(labels?.card?.trim());
        '''),
        d(r'''
          const gallery = resolveGameGalleryItems(game);
          const labels = game.mediaAccessibility;
          const coverImage = resolveGameCoverImage(game);
          const cardImage = resolveGameCardBaseImage(game);
          const coverReady = !coverImage || Boolean(labels?.cover?.trim());
          const cardReady = !cardImage || Boolean(labels?.card?.trim());
        '''),
    ),
    Replacement(
        "src/components/admin/GameMediaAccessibilityEditor.tsx",
        d(r'''
          const hasCard = Boolean(
            assignments.cardMode !== "video" && assignments.cardImage
          );
        '''),
        '  const hasCard = Boolean(assignments.cardImage);\n',
    ),
    Replacement(
        "src/components/admin/GameMediaAccessibilityEditor.tsx",
        d(r'''
                    <small>
                      Úsalo para describir la imagen de descubrimiento cuando aporte información distinta a la Portada.
                    </small>
        '''),
        d(r'''
                    <small>
                      Describe la imagen base 3:2 de la Card. También se usa como fallback cuando el modo activo incluye video o el visitante reduce el movimiento.
                    </small>
        '''),
    ),
    Replacement(
        "src/lib/admin/game-publication-readiness.ts",
        '      detail: "Portada, Card cuando muestra imagen y cada elemento interactivo de Galería tienen texto específico. Hero, Fondo y capas decorativas no bloquean este control.",',
        '      detail: "Portada, la imagen base de Card y cada elemento interactivo de Galería tienen texto específico. Hero, Fondo y capas decorativas no bloquean este control.",',
    ),
    Replacement(
        "src/app/api/admin/content/games/[slug]/background-media/route.ts",
        d(r'''
        import {
          getEditorialItem,
          saveGameMediaDraft,
        } from "@/lib/admin/content-service";
        '''),
        d(r'''
        import {
          getEditorialItem,
          saveGameMediaDraft,
          type GameMediaDraftInput,
        } from "@/lib/admin/content-service";
        '''),
    ),
    Replacement(
        "src/app/api/admin/content/games/[slug]/background-media/route.ts",
        d(r'''
        type MediaDraftUpdate = Parameters<typeof saveGameMediaDraft>[3] &
          Partial<Pick<Game, "backgroundImage" | "mediaModes">>;
        '''),
        'type MediaDraftUpdate = GameMediaDraftInput;\n',
    ),
    Replacement(
        "src/app/api/admin/content/games/[slug]/background-media/route.ts",
        d(r'''
                imageMedia: {
                  ...current.imageMedia,
                  background: { ...DEFAULT_GAME_IMAGE_VIEWPORT },
                },
        '''),
        d(r'''
                imageMedia: {
                  ...current.imageMedia,
                  background: {
                    ...DEFAULT_GAME_IMAGE_VIEWPORT,
                    source: match.src,
                  },
                },
        '''),
    ),
    Replacement(
        "src/app/api/admin/content/games/[slug]/background-media/route.ts",
        d(r'''
                background: {
                  ...viewport,
                  confirmed: true,
                },
        '''),
        d(r'''
                background: {
                  ...viewport,
                  source: current.backgroundImage,
                  confirmed: true,
                },
        '''),
    ),
    Replacement(
        "src/components/admin/GameBackgroundMediaEditor.tsx",
        'import ContextualMediaDialog from "@/components/admin/ContextualMediaDialog";\n',
        'import ContextualMediaDialog from "@/components/admin/ContextualMediaDialog";\nimport { isImageCropConfirmed } from "@/lib/media/game-media-requirements";\n',
    ),
    Replacement(
        "src/components/admin/GameBackgroundMediaEditor.tsx",
        '  const imageCropReady = assignment.imageViewport?.confirmed === true;',
        d(r'''
          const imageCropReady = imageSelected && isImageCropConfirmed(
            assignment.imageViewport ?? undefined,
            undefined,
            undefined,
            assignment.image ?? undefined
          );
        ''').rstrip("\n"),
    ),
    Replacement(
        "src/components/admin/GameDetailMediaEditor.tsx",
        'import ImageViewportEditor from "@/components/admin/ImageViewportEditor";\n',
        'import ImageViewportEditor from "@/components/admin/ImageViewportEditor";\nimport { isImageCropConfirmed } from "@/lib/media/game-media-requirements";\n',
    ),
    Replacement(
        "src/components/admin/GameDetailMediaEditor.tsx",
        '  const imageCropReady = assignment.imageViewport?.confirmed === true;',
        d(r'''
          const imageCropReady = imageSelected && isImageCropConfirmed(
            assignment.imageViewport ?? undefined,
            undefined,
            undefined,
            assignment.image ?? undefined
          );
        ''').rstrip("\n"),
    ),
    Replacement(
        "src/lib/media/game-gallery-media.ts",
        d(r'''
          if (item.kind === "image") {
            return game.imageMedia?.gallery?.[item.src]?.confirmed === true;
          }
        '''),
        d(r'''
          if (item.kind === "image") {
            const viewport = game.imageMedia?.gallery?.[item.src];
            return viewport?.confirmed === true &&
              (viewport.source === undefined || viewport.source === item.src);
          }
        '''),
    ),
    Replacement(
        "src/components/admin/GameGalleryMediaManager.tsx",
        d(r'''
        import {
          MAX_GAME_GALLERY_ITEMS,
        } from "@/lib/media/game-gallery-media";
        '''),
        d(r'''
        import {
          isGameGalleryItemConfirmed,
          MAX_GAME_GALLERY_ITEMS,
        } from "@/lib/media/game-gallery-media";
        '''),
    ),
    Replacement(
        "src/components/admin/GameGalleryMediaManager.tsx",
        d(r'''
          const pendingCount = gallery.filter((item) =>
            item.kind === "image"
              ? imageMedia?.gallery?.[item.src]?.confirmed !== true
              : item.viewport.confirmed !== true
          ).length;
        '''),
        d(r'''
          const pendingCount = gallery.filter(
            (item) =>
              !isGameGalleryItemConfirmed(
                { imageMedia: imageMedia ?? undefined },
                item
              )
          ).length;
        '''),
    ),
    Replacement(
        "src/components/admin/GameGalleryMediaManager.tsx",
        d(r'''
                    const confirmed = item.kind === "image"
                      ? imageViewport?.confirmed === true
                      : item.viewport.confirmed === true;
        '''),
        d(r'''
                    const confirmed = isGameGalleryItemConfirmed(
                      { imageMedia: imageMedia ?? undefined },
                      item
                    );
        '''),
    ),
    Replacement(
        "src/app/api/admin/content/games/[slug]/media/route.ts",
        'import { reconcileGameImageMedia } from "@/lib/media/game-image-media";\n',
        d(r'''
        import {
          resolveGameCardBaseImage,
        } from "@/lib/media/game-card-presentation";
        import { reconcileGameImageMedia } from "@/lib/media/game-image-media";
        '''),
    ),
    Replacement(
        "src/app/api/admin/content/games/[slug]/media/route.ts",
        d(r'''
            const assignments = {
              coverImage: input.coverImage,
              heroImage: input.heroImage,
              cardImage: item.payload.cardImage,
              screenshots: screenshotsText,
            };
        '''),
        d(r'''
            const cardImage = resolveGameCardBaseImage(item.payload);
            const coverArtworkSource =
              input.coverImage === cardImage ? "card" : "custom";
            const assignments = {
              coverImage: input.coverImage,
              heroImage: input.heroImage,
              cardImage: item.payload.cardImage,
              screenshots: screenshotsText,
            };
        '''),
    ),
    Replacement(
        "src/app/api/admin/content/games/[slug]/media/route.ts",
        d(r'''
                {
                  ...assignments,
                  imageMedia: reconcileGameImageMedia(
        '''),
        d(r'''
                {
                  ...assignments,
                  coverArtworkSource,
                  imageMedia: reconcileGameImageMedia(
        '''),
    ),
    Replacement(
        "src/lib/admin/content-service.ts",
        d(r'''
        export type GameMediaDraftInput = Pick<
          Game,
          | "coverImage"
          | "heroImage"
          | "screenshots"
          | "imageMedia"
          | "videoMedia"
          | "previewMode"
          | "previewClip"
          | "youtubePreview"
        >;
        '''),
        d(r'''
        export type GameMediaDraftInput = Pick<
          Game,
          | "coverImage"
          | "coverArtworkSource"
          | "heroImage"
          | "cardImage"
          | "detailImage"
          | "backgroundImage"
          | "screenshots"
          | "galleryMedia"
          | "imageMedia"
          | "mediaModes"
          | "videoMedia"
          | "previewMode"
          | "previewClip"
          | "youtubePreview"
          | "directPreview"
        >;
        '''),
    ),
    Replacement(
        "src/app/api/admin/content/games/[slug]/media-library/route.ts",
        d(r'''
        import {
          getEditorialItem,
          saveGameMediaDraft,
        } from "@/lib/admin/content-service";
        '''),
        d(r'''
        import {
          getEditorialItem,
          saveGameMediaDraft,
          type GameMediaDraftInput,
        } from "@/lib/admin/content-service";
        '''),
    ),
    Replacement(
        "src/app/api/admin/content/games/[slug]/media-library/route.ts",
        d(r'''
        type MediaDraftUpdate = Parameters<typeof saveGameMediaDraft>[3] &
          Partial<
            Pick<
              Game,
              | "backgroundImage"
              | "cardImage"
              | "coverArtworkSource"
              | "detailImage"
              | "galleryMedia"
              | "mediaModes"
            >
          >;
        '''),
        'type MediaDraftUpdate = GameMediaDraftInput;\n',
    ),
    Replacement(
        "src/app/api/admin/content/games/[slug]/gallery-media/route.ts",
        d(r'''
        import {
          getEditorialItem,
          saveGameMediaDraft,
        } from "@/lib/admin/content-service";
        '''),
        d(r'''
        import {
          getEditorialItem,
          saveGameMediaDraft,
          type GameMediaDraftInput,
        } from "@/lib/admin/content-service";
        '''),
    ),
    Replacement(
        "src/app/api/admin/content/games/[slug]/gallery-media/route.ts",
        d(r'''
          return {
            galleryMedia: items,
            screenshots: syncedScreenshots(items),
            ...(imageMedia ? { imageMedia } : {}),
          } as Parameters<typeof saveGameMediaDraft>[3] &
            Partial<Pick<Game, "galleryMedia">>;
        '''),
        d(r'''
          return {
            galleryMedia: items,
            screenshots: syncedScreenshots(items),
            ...(imageMedia ? { imageMedia } : {}),
          } satisfies GameMediaDraftInput;
        '''),
    ),
    Replacement(
        "src/app/juegos/[slug]/page.tsx",
        d(r'''
        import {
          getGameGalleryAccessibleFallback,
        } from "@/lib/media/game-media-accessibility";
        '''),
        d(r'''
        import {
          resolveGameCoverAlt,
          resolveGameCoverImage,
        } from "@/lib/media/game-card-presentation";
        import {
          getGameGalleryAccessibleFallback,
        } from "@/lib/media/game-media-accessibility";
        '''),
    ),
    Replacement(
        "src/app/juegos/[slug]/page.tsx",
        d(r'''
          const title = game.title;
          const description = game.description;
          const image = game.heroImage ?? game.coverImage;
          const imageAlt = game.heroImage
            ? game.mediaAccessibility?.hero ?? game.imageAlt
            : game.mediaAccessibility?.cover ?? game.imageAlt;
        '''),
        d(r'''
          const title = game.title;
          const description = game.description;
          const resolvedCoverImage = resolveGameCoverImage(game);
          const image = game.heroImage ?? resolvedCoverImage;
          const imageAlt = game.heroImage
            ? game.mediaAccessibility?.hero ?? game.imageAlt
            : resolveGameCoverAlt(game);
        '''),
    ),
    Replacement(
        "src/app/juegos/[slug]/page.tsx",
        d(r'''
          const gameJsonLd = {
            "@context": "https://schema.org",
            "@type": "VideoGame",
            name: game.title,
            description: game.description,
            url: absoluteUrl(`/juegos/${game.slug}`),
            image: game.coverImage
              ? absoluteUrl(game.coverImage)
              : undefined,
        '''),
        d(r'''
          const resolvedCoverImage = resolveGameCoverImage(game);
          const gameJsonLd = {
            "@context": "https://schema.org",
            "@type": "VideoGame",
            name: game.title,
            description: game.description,
            url: absoluteUrl(`/juegos/${game.slug}`),
            image: resolvedCoverImage
              ? absoluteUrl(resolvedCoverImage)
              : undefined,
        '''),
    ),
    Replacement(
        "src/features/game-finder/GameFinderClient.tsx",
        'import UniversalGameCardBase from "@/components/ui/UniversalGameCardBase";\n',
        d(r'''
        import UniversalGameCardBase from "@/components/ui/UniversalGameCardBase";
        import {
          resolveGameCoverAlt,
          resolveGameCoverImage,
        } from "@/lib/media/game-card-presentation";
        '''),
    ),
    Replacement(
        "src/features/game-finder/GameFinderClient.tsx",
        'function GameResultCard({\n',
        d(r'''
        function FinderDetailCover({ game }: { game: Game }) {
          const image = resolveGameCoverImage(game);
          if (!image) return null;

          return (
            <Image
              src={image}
              alt={resolveGameCoverAlt(game)}
              fill
              sizes="330px"
              className={styles.detailImage}
            />
          );
        }

        function GameResultCard({
        '''),
    ),
    Replacement(
        "src/features/game-finder/GameFinderClient.tsx",
        d(r'''
                    {selectedGame.coverImage && (
                      <Image
                        src={selectedGame.coverImage}
                        alt={selectedGame.imageAlt}
                        fill
                        sizes="330px"
                        className={styles.detailImage}
                      />
                    )}
        '''),
        '                <FinderDetailCover game={selectedGame} />\n',
    ),
    Replacement(
        "src/app/cuenta/page.tsx",
        d(r'''
        import {
          getPublicGames,
        } from "@/lib/games/public-catalog";
        '''),
        d(r'''
        import {
          getPublicGames,
        } from "@/lib/games/public-catalog";
        import {
          resolveGameCoverImage,
        } from "@/lib/media/game-card-presentation";
        '''),
    ),
    Replacement(
        "src/app/cuenta/page.tsx",
        '            coverImage: game.coverImage,',
        '            coverImage: resolveGameCoverImage(game),',
    ),
    Replacement(
        "src/lib/accounts/update-notifications.ts",
        'import type { GameImageViewport } from "@/types/game";\n',
        'import { resolveGameCardBaseImage } from "@/lib/media/game-card-presentation";\nimport type { GameImageViewport } from "@/types/game";\n',
    ),
    Replacement(
        "src/lib/accounts/update-notifications.ts",
        d(r'''
              gameCoverImage:
                update.game.cardImage ?? update.game.coverImage,
        '''),
        '      gameCoverImage: resolveGameCardBaseImage(update.game),\n',
    ),
    Replacement(
        "tools/check-media-accessibility.mjs",
        d(r'''
        assert(
          files.editor.includes("/media-workspace") &&
            files.editor.includes("/media-accessibility") &&
            files.editor.includes('name="expectedRevision"') &&
            files.editor.includes('name="accessibilityJson"') &&
            files.editor.includes("workspace.revision !== revision") &&
            files.editor.includes("maxLength={240}") &&
            files.editor.includes("GameEditorFormActions") &&
            files.multimediaEditor.includes("GameMediaAccessibilityEditor"),
          "Multimedia debe integrar un editor accesible sobre el workspace y revisión actuales."
        );
        '''),
        d(r'''
        assert(
          files.editor.includes("/media-workspace") &&
            files.editor.includes("/media-accessibility") &&
            files.editor.includes('name="expectedRevision"') &&
            files.editor.includes('name="accessibilityJson"') &&
            files.editor.includes("workspace.revision !== revision") &&
            files.editor.includes("maxLength={240}") &&
            files.editor.includes("const hasCard = Boolean(assignments.cardImage)") &&
            files.editor.includes("GameEditorFormActions") &&
            files.multimediaEditor.includes("GameMediaAccessibilityEditor"),
          "Multimedia debe integrar un editor accesible y mantener el alt de la imagen base de Card incluso cuando su modo activo sea Video."
        );
        '''),
    ),
    Replacement(
        "tools/check-media-accessibility.mjs",
        d(r'''
        assert(
          files.accessibility.includes("getGameGalleryAccessibilityLabel") &&
            files.accessibility.includes("getGameGalleryAccessibleFallback") &&
            files.accessibility.includes("hasCompleteContextualMediaAccessibility") &&
            files.accessibility.includes('resolveGameDestinationMediaMode(game, "card")'),
          "La resolución pública y el readiness deben compartir una sola lógica de accesibilidad contextual."
        );

        assert(
          files.cover.includes("game.mediaAccessibility?.cover ?? game.imageAlt"),
          "La Portada pública debe preferir el texto contextual y conservar el fallback histórico."
        );
        assert(
          files.cardPresentation.includes("game.mediaAccessibility?.card ?? game.imageAlt") &&
            files.card.includes("resolveGameCardPresentation") &&
            files.card.includes("presentation.card.alt"),
          "La Card pública debe resolver el texto contextual en la presentación canónica y el renderer debe consumirlo sin lógica paralela."
        );
        '''),
        d(r'''
        assert(
          files.accessibility.includes("getGameGalleryAccessibilityLabel") &&
            files.accessibility.includes("getGameGalleryAccessibleFallback") &&
            files.accessibility.includes("hasCompleteContextualMediaAccessibility") &&
            files.accessibility.includes("resolveGameCoverImage") &&
            files.accessibility.includes("resolveGameCardBaseImage") &&
            !files.accessibility.includes('resolveGameDestinationMediaMode(game, "card")'),
          "La resolución pública y el readiness deben exigir textos contextuales sobre los recursos efectivos, incluida la imagen base de Card en modo Video."
        );

        assert(
          files.cover.includes("resolveGameCoverAlt") &&
            files.cover.includes("alt={resolveGameCoverAlt(game)}"),
          "La Portada pública debe preferir exclusivamente su texto contextual y conservar el fallback histórico general."
        );
        assert(
          files.cardPresentation.includes("resolveGameCoverAlt") &&
            files.cardPresentation.includes("resolveGameCardAlt") &&
            files.cardPresentation.includes("alt: resolveGameCoverAlt(game)") &&
            files.cardPresentation.includes("alt: resolveGameCardAlt(game)") &&
            !files.cardPresentation.includes("game.mediaAccessibility?.cover ??\\n        game.mediaAccessibility?.card") &&
            files.card.includes("resolveGameCardPresentation") &&
            files.card.includes("presentation.card.alt"),
          "Card y Portada deben resolver textos alternativos independientes desde una única presentación canónica."
        );
        '''),
    ),
    Replacement(
        "tools/check-media-accessibility.mjs",
        d(r'''
            files.publicPage.includes("game.mediaAccessibility?.hero ?? game.imageAlt") &&
            files.publicPage.includes("getPublicGameBySlug") &&
        '''),
        d(r'''
            files.publicPage.includes("game.mediaAccessibility?.hero ?? game.imageAlt") &&
            files.publicPage.includes("resolveGameCoverImage") &&
            files.publicPage.includes("resolveGameCoverAlt") &&
            files.publicPage.includes("getPublicGameBySlug") &&
        '''),
    ),
    Replacement(
        "tools/check-media-accessibility.mjs",
        d(r'''
        assert(
          files.readiness.includes("hasCompleteContextualMediaAccessibility") &&
            files.readiness.includes('id: "media-accessibility"') &&
            files.readiness.includes('priority: "recommended"'),
          "El checklist debe recomendar accesibilidad contextual sin bloquear publicaciones históricas."
        );
        '''),
        d(r'''
        assert(
          files.readiness.includes("hasCompleteContextualMediaAccessibility") &&
            files.readiness.includes('id: "media-accessibility"') &&
            files.readiness.includes("Portada, la imagen base de Card") &&
            files.readiness.includes('priority: "recommended"'),
          "El checklist debe recomendar accesibilidad contextual de Portada/Card base sin bloquear publicaciones históricas."
        );
        '''),
    ),
    Replacement(
        "tools/check-game-background-media.mjs",
        d(r'''
            "backgroundImage: match.src",
            "DEFAULT_GAME_IMAGE_VIEWPORT",
            "aspect: GAME_BACKGROUND_VIEWPORT_ASPECT",
            "confirmed: true",
        '''),
        d(r'''
            "backgroundImage: match.src",
            "DEFAULT_GAME_IMAGE_VIEWPORT",
            "source: match.src",
            "source: current.backgroundImage",
            "aspect: GAME_BACKGROUND_VIEWPORT_ASPECT",
            "confirmed: true",
        '''),
    ),
    Replacement(
        "tools/check-game-background-media.mjs",
        d(r'''
            "assignment: BackgroundAssignment"
          ) &&
        '''),
        d(r'''
            "assignment: BackgroundAssignment",
            "isImageCropConfirmed"
          ) &&
        '''),
    ),
    Replacement(
        "tools/check-game-background-media.mjs",
        d(r'''
            "type MediaDraftUpdate = Parameters<typeof saveGameMediaDraft>[3]",
            '| "backgroundImage"',
            '| "cardImage"',
            '| "detailImage"',
            '| "galleryMedia"',
            '| "mediaModes"',
        '''),
        d(r'''
            "type MediaDraftUpdate = GameMediaDraftInput",
            "type GameMediaDraftInput",
        '''),
    ),
    Replacement(
        "package.json",
        "node ./tools/check-game-media-hygiene.mjs && node ./tools/check-required-media-destinations.mjs",
        "node ./tools/check-game-media-hygiene.mjs && node ./tools/check-media-accessibility.mjs && node ./tools/check-card-cover-post-audit.mjs && node ./tools/check-required-media-destinations.mjs",
    ),
]

NEW_CHECKER = r'''import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const source = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};
const has = (text, ...needles) => needles.every((needle) => text.includes(needle));

const [
  presentation,
  accessibility,
  accessibilityEditor,
  readiness,
  backgroundRoute,
  backgroundEditor,
  detailEditor,
  galleryDomain,
  galleryEditor,
  legacyMediaRoute,
  contentService,
  mediaLibraryRoute,
  galleryRoute,
  finder,
  accountPage,
  notifications,
  publicPage,
] = await Promise.all([
  source("src/lib/media/game-card-presentation.ts"),
  source("src/lib/media/game-media-accessibility.ts"),
  source("src/components/admin/GameMediaAccessibilityEditor.tsx"),
  source("src/lib/admin/game-publication-readiness.ts"),
  source("src/app/api/admin/content/games/[slug]/background-media/route.ts"),
  source("src/components/admin/GameBackgroundMediaEditor.tsx"),
  source("src/components/admin/GameDetailMediaEditor.tsx"),
  source("src/lib/media/game-gallery-media.ts"),
  source("src/components/admin/GameGalleryMediaManager.tsx"),
  source("src/app/api/admin/content/games/[slug]/media/route.ts"),
  source("src/lib/admin/content-service.ts"),
  source("src/app/api/admin/content/games/[slug]/media-library/route.ts"),
  source("src/app/api/admin/content/games/[slug]/gallery-media/route.ts"),
  source("src/features/game-finder/GameFinderClient.tsx"),
  source("src/app/cuenta/page.tsx"),
  source("src/lib/accounts/update-notifications.ts"),
  source("src/app/juegos/[slug]/page.tsx"),
]);

assert(
  has(
    presentation,
    "resolveGameCoverAlt",
    "resolveGameCardAlt",
    "alt: resolveGameCoverAlt(game)",
    "alt: resolveGameCardAlt(game)"
  ) &&
    !presentation.includes(
      "game.mediaAccessibility?.cover ??\n        game.mediaAccessibility?.card"
    ),
  "Card y Portada deben mantener textos alternativos contextuales independientes."
);

assert(
  has(
    accessibility,
    "resolveGameCoverImage",
    "resolveGameCardBaseImage",
    "const cardImage = resolveGameCardBaseImage(game)"
  ) &&
    !accessibility.includes('resolveGameDestinationMediaMode(game, "card")') &&
    has(
      accessibilityEditor,
      "const hasCard = Boolean(assignments.cardImage)",
      "imagen base 3:2 de la Card"
    ) &&
    readiness.includes("Portada, la imagen base de Card"),
  "La accesibilidad de la imagen base de Card debe seguir activa en modo Video."
);

assert(
  has(
    backgroundRoute,
    "source: match.src",
    "source: current.backgroundImage",
    "confirmed: true"
  ) &&
    has(backgroundEditor, "isImageCropConfirmed", "assignment.image ?? undefined") &&
    has(detailEditor, "isImageCropConfirmed", "assignment.image ?? undefined"),
  "Fondo y Contenedor deben ligar el recorte adaptable a su asset activo y mostrar el mismo readiness que dominio."
);

assert(
  has(
    galleryDomain,
    "viewport.source === undefined || viewport.source === item.src"
  ) &&
    has(
      galleryEditor,
      "isGameGalleryItemConfirmed",
      "{ imageMedia: imageMedia ?? undefined }"
    ),
  "Galería debe rechazar provenance obsoleta sin romper snapshots históricos sin source."
);

assert(
  has(
    legacyMediaRoute,
    "resolveGameCardBaseImage",
    "const coverArtworkSource =",
    'input.coverImage === cardImage ? "card" : "custom"',
    "coverArtworkSource,"
  ),
  "La ruta multimedia legacy debe traducir escrituras directas de Portada a intención shared/custom."
);

for (const field of [
  '"coverArtworkSource"',
  '"cardImage"',
  '"detailImage"',
  '"backgroundImage"',
  '"galleryMedia"',
  '"mediaModes"',
  '"directPreview"',
]) {
  assert(
    contentService.includes(field),
    `GameMediaDraftInput debe incluir ${field}.`
  );
}
assert(
  has(mediaLibraryRoute, "type GameMediaDraftInput", "type MediaDraftUpdate = GameMediaDraftInput") &&
    has(galleryRoute, "type GameMediaDraftInput", "satisfies GameMediaDraftInput"),
  "Las rutas multimedia deben consumir el contrato central de persistencia en vez de ampliarlo localmente."
);

assert(
  has(
    finder,
    "resolveGameCoverImage",
    "resolveGameCoverAlt",
    "function FinderDetailCover"
  ),
  "El detalle de Finder debe resolver la Portada efectiva y su alt contextual."
);

assert(
  has(accountPage, "resolveGameCoverImage", "coverImage: resolveGameCoverImage(game)") &&
    has(notifications, "resolveGameCardBaseImage", "gameCoverImage: resolveGameCardBaseImage(update.game)"),
  "Cuenta y avisos deben usar los resolvers canónicos de Portada/Card."
);

assert(
  has(
    publicPage,
    "resolveGameCoverImage",
    "resolveGameCoverAlt",
    "const resolvedCoverImage = resolveGameCoverImage(game)",
    "image: resolvedCoverImage"
  ),
  "Metadata social y JSON-LD deben consumir la Portada efectiva, no el campo de compatibilidad crudo."
);

if (failures.length) {
  console.error("Post-audit Card/Portada: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "Post-audit Card/Portada: OK (accesibilidad, provenance, legacy, persistencia, SEO, Finder y Cuenta)."
);
'''

def run(cmd: list[str], cwd: Path, capture: bool = False) -> str:
    result = subprocess.run(
        cmd,
        cwd=cwd,
        text=True,
        capture_output=capture,
        check=False,
    )
    if result.returncode != 0:
        if capture:
            sys.stderr.write(result.stdout)
            sys.stderr.write(result.stderr)
        raise SystemExit(result.returncode)
    return result.stdout.strip() if capture else ""

def verify_repo(root: Path, allow_dirty: bool) -> None:
    if not (root / ".git").exists():
        raise SystemExit("ERROR: ejecuta este script desde la raíz del repo deuna-games.")
    if not allow_dirty:
        dirty = run(["git", "status", "--porcelain"], root, capture=True)
        if dirty:
            raise SystemExit(
                "ERROR: el working tree tiene cambios. Guarda/stashea tus cambios o usa --allow-dirty."
            )
    is_ancestor = subprocess.run(
        ["git", "merge-base", "--is-ancestor", EXPECTED_BASE, "HEAD"],
        cwd=root,
        check=False,
    ).returncode == 0
    if not is_ancestor:
        head = run(["git", "rev-parse", "HEAD"], root, capture=True)
        raise SystemExit(
            f"ERROR: este kit está preparado para un HEAD que contenga {EXPECTED_BASE}. HEAD actual: {head}"
        )

def verify_replacements(root: Path) -> None:
    staged_by_path: dict[str, str] = {}
    for replacement in REPLACEMENTS:
        current = staged_by_path.get(replacement.path)
        if current is None:
            target = root / replacement.path
            if not target.is_file():
                raise SystemExit(f"ERROR: falta {replacement.path}.")
            current = target.read_text(encoding="utf-8")
        count = current.count(replacement.old)
        if count != 1:
            raise SystemExit(
                f"ERROR: {replacement.path}: patrón esperado encontrado {count} veces; "
                "no aplico cambios para evitar tocar una versión distinta."
            )
        staged_by_path[replacement.path] = current.replace(
            replacement.old, replacement.new, 1
        )

    checker = root / "tools/check-card-cover-post-audit.mjs"
    if checker.exists() and checker.read_text(encoding="utf-8") != NEW_CHECKER:
        raise SystemExit(
            "ERROR: tools/check-card-cover-post-audit.mjs ya existe con contenido distinto."
        )

def apply_changes(root: Path) -> list[str]:
    staged: dict[str, str] = {}
    order: list[str] = []
    for replacement in REPLACEMENTS:
        if replacement.path not in staged:
            staged[replacement.path] = (root / replacement.path).read_text(encoding="utf-8")
            order.append(replacement.path)
        staged[replacement.path] = staged[replacement.path].replace(
            replacement.old, replacement.new, 1
        )

    for rel in order:
        (root / rel).write_text(staged[rel], encoding="utf-8", newline="\n")

    checker_path = root / "tools/check-card-cover-post-audit.mjs"
    checker_path.write_text(NEW_CHECKER, encoding="utf-8", newline="\n")
    return [*order, "tools/check-card-cover-post-audit.mjs"]

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Aplica el hardening post-audit de Card/Portada sobre DeUna Games."
    )
    parser.add_argument("--apply", action="store_true", help="Escribe los cambios. Sin esta bandera sólo verifica.")
    parser.add_argument("--checks", action="store_true", help="Después de aplicar, ejecuta check + audit:deps + security:scan.")
    parser.add_argument("--allow-dirty", action="store_true", help="Permite ejecutar con cambios locales existentes (no recomendado).")
    args = parser.parse_args()

    root = Path.cwd()
    verify_repo(root, args.allow_dirty)
    verify_replacements(root)

    if not args.apply:
        print(
            f"OK: {len(REPLACEMENTS)} reemplazos y 1 checker nuevo son aplicables sobre este checkout."
        )
        print("Ejecuta de nuevo con --apply para escribirlos.")
        return

    changed = apply_changes(root)
    run(["git", "diff", "--check"], root)
    diff = run(["git", "diff", "--binary", "--", *changed], root, capture=True)
    (root / PATCH_NAME).write_text(diff + "\n", encoding="utf-8", newline="\n")

    print(f"Aplicado: {len(changed)} archivos.")
    print(f"Patch de revisión generado: {PATCH_NAME}")
    print("git diff --check: OK")

    if args.checks:
        run(["npm", "run", "check"], root)
        run(["npm", "run", "audit:deps"], root)
        run(["npm", "run", "security:scan"], root)
        print("check + audit:deps + security:scan: OK")
    else:
        print("Pendiente local: npm run check && npm run audit:deps && npm run security:scan")

if __name__ == "__main__":
    main()
