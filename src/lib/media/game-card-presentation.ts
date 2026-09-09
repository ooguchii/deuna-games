import type { HomeSectionId } from "@/data/home-config";

export const GAME_CARD_PRESENTATION_MODES = [
  "poster",
  "detail-image",
  "detail-video",
] as const;

export type GameCardPresentationMode =
  (typeof GAME_CARD_PRESENTATION_MODES)[number];

export const DEFAULT_HOME_GAME_CARD_PRESENTATION: GameCardPresentationMode =
  "detail-image";

export const DEFAULT_GLOBAL_GAME_CARD_PRESENTATION: GameCardPresentationMode =
  "poster";

export const HOME_GAME_CARD_SECTION_IDS = [
  "popular",
  "recent",
  "lowSpec",
  "recommended",
] as const satisfies readonly HomeSectionId[];

export function isGameCardPresentationMode(
  value: unknown
): value is GameCardPresentationMode {
  return GAME_CARD_PRESENTATION_MODES.includes(
    value as GameCardPresentationMode
  );
}

export function isHomeGameCardSectionId(
  value: HomeSectionId
): value is (typeof HOME_GAME_CARD_SECTION_IDS)[number] {
  return HOME_GAME_CARD_SECTION_IDS.includes(
    value as (typeof HOME_GAME_CARD_SECTION_IDS)[number]
  );
}
