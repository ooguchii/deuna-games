const DAY_MONTH_YEAR = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const YEAR_MONTH_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T/;

const SPANISH_SHORT_MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sept",
  "oct",
  "nov",
  "dic",
] as const;

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

function formatUtcDate(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getUTCDate()} ${SPANISH_SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
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

export function hasGameIsoDatePrefix(value: string) {
  return ISO_INSTANT.test(value.trim());
}

export function parseGameIsoDatePrefix(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const match = ISO_INSTANT.exec(trimmed);
  if (!match) return null;

  return utcCivilTimestamp(
    Number(match[1]),
    Number(match[2]),
    Number(match[3])
  );
}

export function formatGameReleaseDate(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const civil = parseGameCivilDate(trimmed);
  if (civil !== null) {
    return formatUtcDate(civil);
  }

  // A date-looking value with an impossible calendar day must stay visible as
  // entered instead of being silently normalized to another day/month.
  if (hasGameCivilDateSyntax(trimmed)) {
    return trimmed;
  }

  // Preserve deterministic formatting for explicit ISO instants, but validate
  // their calendar prefix first so Date.parse cannot normalize 31 February.
  if (hasGameIsoDatePrefix(trimmed)) {
    if (parseGameIsoDatePrefix(trimmed) === null) {
      return trimmed;
    }

    const instant = Date.parse(trimmed);
    if (!Number.isNaN(instant)) {
      return formatUtcDate(instant);
    }
  }

  // Free-form editorial text is not guessed as a date. This keeps SSR/client
  // output deterministic and avoids inventing semantics for human labels.
  return trimmed;
}
