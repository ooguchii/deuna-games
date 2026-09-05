const HERO_ASPECT_MAX_TERM = 100;

function gcd(left: number, right: number) {
  let a = Math.max(1, Math.round(Math.abs(left)));
  let b = Math.max(1, Math.round(Math.abs(right)));
  while (b) [a, b] = [b, a % b];
  return a;
}

export type HeroAspectTerms = {
  width: number;
  height: number;
};

/**
 * Represents a positive frame ratio with small integer terms without distorting
 * the ratio by clamping numerator and denominator independently.
 *
 * Exact reduced fractions are preserved whenever both terms fit in the editor's
 * 1..100 controls. Otherwise we choose the closest fraction whose two terms are
 * both bounded. Hero frame dimensions are already schema-bounded, so a valid
 * candidate always exists well inside this range.
 */
export function simplifyHeroFrameRatio(
  width: number,
  height: number
): HeroAspectTerms {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return { width: 1, height: 1 };
  }

  const roundedWidth = Math.max(1, Math.round(width));
  const roundedHeight = Math.max(1, Math.round(height));
  const exactDivisor = gcd(roundedWidth, roundedHeight);
  const exactWidth = roundedWidth / exactDivisor;
  const exactHeight = roundedHeight / exactDivisor;

  if (
    exactWidth <= HERO_ASPECT_MAX_TERM &&
    exactHeight <= HERO_ASPECT_MAX_TERM
  ) {
    return { width: exactWidth, height: exactHeight };
  }

  const target = roundedWidth / roundedHeight;
  let bestWidth = 1;
  let bestHeight = 1;
  let bestError = Number.POSITIVE_INFINITY;

  for (let candidateHeight = 1; candidateHeight <= HERO_ASPECT_MAX_TERM; candidateHeight += 1) {
    const candidateWidth = Math.round(target * candidateHeight);
    if (candidateWidth < 1 || candidateWidth > HERO_ASPECT_MAX_TERM) continue;

    const error = Math.abs(candidateWidth / candidateHeight - target);
    if (
      error < bestError - Number.EPSILON ||
      (Math.abs(error - bestError) <= Number.EPSILON &&
        candidateHeight > bestHeight)
    ) {
      bestWidth = candidateWidth;
      bestHeight = candidateHeight;
      bestError = error;
    }
  }

  const divisor = gcd(bestWidth, bestHeight);
  return {
    width: bestWidth / divisor,
    height: bestHeight / divisor,
  };
}
