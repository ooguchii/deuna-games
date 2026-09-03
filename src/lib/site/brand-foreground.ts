const DARK_FOREGROUND = "#05080d";
const LIGHT_FOREGROUND = "#ffffff";
const DARK_BACKGROUND = {
  red: 5,
  green: 6,
  blue: 11,
};
const MINIMUM_LIGHT_TEXT_CONTRAST = 7;

type RgbColor = {
  red: number;
  green: number;
  blue: number;
};

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

function parseHexColor(value: string): RgbColor | null {
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

function lightTextContrast(color: RgbColor) {
  return contrastRatio(
    relativeLuminance(color.red, color.green, color.blue),
    1
  );
}

function blendColor(
  foreground: RgbColor,
  background: RgbColor,
  foregroundWeight: number
): RgbColor {
  const backgroundWeight = 1 - foregroundWeight;

  return {
    red: Math.round(
      foreground.red * foregroundWeight +
      background.red * backgroundWeight
    ),
    green: Math.round(
      foreground.green * foregroundWeight +
      background.green * backgroundWeight
    ),
    blue: Math.round(
      foreground.blue * foregroundWeight +
      background.blue * backgroundWeight
    ),
  };
}

function rgbToHex(color: RgbColor) {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, value))
      .toString(16)
      .padStart(2, "0");

  return `#${channel(color.red)}${channel(color.green)}${channel(color.blue)}`;
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

/**
 * Mantiene el color de fondo elegido cuando ya es apto para una interfaz
 * oscura. Si es demasiado claro, conserva la mayor proporción posible del
 * tono elegido y lo mezcla con la base oscura hasta obtener contraste AAA
 * (7:1) frente al texto claro del sistema.
 */
export function safeThemeBackground(themeColor: string) {
  const parsed = parseHexColor(themeColor);
  if (!parsed) return rgbToHex(DARK_BACKGROUND);

  if (lightTextContrast(parsed) >= MINIMUM_LIGHT_TEXT_CONTRAST) {
    return rgbToHex(parsed);
  }

  let low = 0;
  let high = 1;
  let safe = DARK_BACKGROUND;

  for (let iteration = 0; iteration < 14; iteration += 1) {
    const weight = (low + high) / 2;
    const candidate = blendColor(parsed, DARK_BACKGROUND, weight);

    if (lightTextContrast(candidate) >= MINIMUM_LIGHT_TEXT_CONTRAST) {
      safe = candidate;
      low = weight;
    } else {
      high = weight;
    }
  }

  return rgbToHex(safe);
}
