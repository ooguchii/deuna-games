import {
  createHash,
} from "node:crypto";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (
    value &&
    typeof value === "object" &&
    !(value instanceof Date)
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) =>
          left.localeCompare(right)
        )
        .map(([key, entry]) => [
          key,
          stableValue(entry),
        ])
    );
  }

  return value;
}

export function normalizeEditorialPayload<T>(
  value: T
): T {
  return JSON.parse(
    JSON.stringify(stableValue(value))
  ) as T;
}

export function hashEditorialPayload(
  value: unknown
) {
  return createHash("sha256")
    .update(
      JSON.stringify(stableValue(value)),
      "utf8"
    )
    .digest("hex");
}
