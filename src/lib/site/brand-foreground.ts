const DARK_FOREGROUND = "#05080d";
const LIGHT_FOREGROUND = "#ffffff";

function channelToLinear(value: number) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(red: number, green: number, blue: number) {
  return (
    0.2126 * channelToLinear(red) +
    0.7152 * channelToLinear(green) +
    0.0722 * channelToLinear(blue)
  );
}

function parseHexColor(value: string) {
  const normalized = value.trim().replace(/^#/, "");

  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return null;
  }

  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function contrastRatio(first: number, second: number) {
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Elige el texto con mayor contraste WCAG frente al color de marca.
 * La validación editorial garantiza #RRGGBB; el fallback mantiene seguro
 * cualquier uso fuera de ese flujo.
 */
export function brandForeground(brandColor: string) {
  const parsed = parseHexColor(brandColor);
  if (!parsed) return LIGHT_FOREGROUND;

  const brandLuminance = relativeLuminance(
    parsed.red,
    parsed.green,
    parsed.blue
  );
  const darkLuminance = relativeLuminance(5, 8, 13);
  const lightLuminance = 1;

  return contrastRatio(brandLuminance, darkLuminance) >=
    contrastRatio(brandLuminance, lightLuminance)
    ? DARK_FOREGROUND
    : LIGHT_FOREGROUND;
}
