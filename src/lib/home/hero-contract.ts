export const HOME_HERO_MAX_SLIDES = 5;
export const HOME_HERO_VISIBLE_PREVIEWS = 3;
export const HOME_HERO_AUTOPLAY_MS = 6500;

export function formatHomeHeroPosition(index: number, total: number) {
  const width = Math.max(2, String(Math.max(total, 1)).length);
  return `${String(index + 1).padStart(width, "0")} / ${String(total).padStart(width, "0")}`;
}
