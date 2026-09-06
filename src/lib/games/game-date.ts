const DAY_MONTH_YEAR = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const YEAR_MONTH_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T/;

const releaseDateFormatter = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function utcCivilTimestamp(
  year: number,
  month: number,
  day: number
) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.getTime();
}

export function hasGameCivilDateSyntax(value: string) {
  const trimmed = value.trim();
  return DAY_MONTH_YEAR.test(trimmed) || YEAR_MONTH_DAY.test(trimmed);
}

export function parseGameCivilDate(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const local = DAY_MONTH_YEAR.exec(trimmed);
  if (local) {
    return utcCivilTimestamp(
      Number(local[3]),
      Number(local[2]),
      Number(local[1])
    );
  }

  const canonical = YEAR_MONTH_DAY.exec(trimmed);
  if (canonical) {
    return utcCivilTimestamp(
      Number(canonical[1]),
      Number(canonical[2]),
      Number(canonical[3])
    );
  }

  return null;
}

export function formatGameReleaseDate(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const civil = parseGameCivilDate(trimmed);
  if (civil !== null) {
    return releaseDateFormatter.format(new Date(civil));
  }

  // A date-looking value with an impossible calendar day must stay visible as
  // entered instead of being silently normalized to another day/month.
  if (hasGameCivilDateSyntax(trimmed)) {
    return trimmed;
  }

  // Preserve deterministic formatting for explicit ISO instants. Free-form
  // editorial text is not guessed as a date because Date.parse semantics are
  // not an appropriate contract for a civil release date.
  if (ISO_INSTANT.test(trimmed)) {
    const instant = Date.parse(trimmed);
    if (!Number.isNaN(instant)) {
      return releaseDateFormatter.format(new Date(instant));
    }
  }

  return trimmed;
}
