export type ListingCursorResult<T> =
  | { cursor: T | null; ok: true }
  | { cursor: null; ok: false };

export function encodeListingCursor(fields: Record<string, number | string>) {
  return Buffer.from(JSON.stringify(fields), "utf8").toString("base64url");
}

export function decodeListingCursor<T>(
  value: string | null,
  validate: (payload: unknown) => T | null,
): ListingCursorResult<T> {
  if (value === null || value.trim() === "") {
    return { cursor: null, ok: true };
  }

  try {
    const payload = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as unknown;
    const cursor = validate(payload);

    return cursor ? { cursor, ok: true } : { cursor: null, ok: false };
  } catch {
    return { cursor: null, ok: false };
  }
}

export function readCursorRecord(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}
