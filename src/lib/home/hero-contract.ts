export const HOME_HERO_MAX_SLIDES = 5;
export const HOME_HERO_VISIBLE_PREVIEWS = 3;
export const HOME_HERO_AUTOPLAY_MS = 6500;
// Four complete designs (base plus three devices), including URL encoding.
export const HOME_HERO_MAX_JSON_CHARS = 20_000;
export const HOME_HERO_MAX_FORM_BYTES = 192 * 1024;

export function formatHomeHeroPosition(index: number, total: number) {
  const width = Math.max(2, String(Math.max(total, 1)).length);
  return `${String(index + 1).padStart(width, "0")} / ${String(total).padStart(width, "0")}`;
}