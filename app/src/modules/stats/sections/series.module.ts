import type { SessionListCursor } from "@modules/types";

/**
 * Shared, pure helpers every section module uses: bucket closure
 * (`10-Statistics/00-Overview.md` §5.2), the session-list cursor codec, and
 * the `dataVersion` codec (D367 decision 6). No I/O; isomorphic.
 */

function toBase64Url(input: string): string {
  return btoa(input)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function fromBase64Url(input: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) return null;
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  try {
    return atob(padded + "=".repeat(padLength));
  } catch {
    return null;
  }
}

/** A bucket is closed once it ends before the request time — no completed session can ever land in it again. */
export function isClosed(bucketEnd: string, to: string, now: Date): boolean {
  const endMs = Date.parse(bucketEnd);
  const toMs = Date.parse(to);
  return endMs <= Math.min(toMs, now.getTime());
}

/** Opaque, server-owned session-list cursor (`06-API/03-Shared-Conventions.md` §Pagination). */
export function encodeCursor(cursor: SessionListCursor): string {
  return toBase64Url(JSON.stringify(cursor));
}

/** Returns `null` on any malformed input rather than throwing — a client never constructs this string. */
export function decodeCursor(value: string): SessionListCursor | null {
  const decoded = fromBase64Url(value);
  if (decoded === null) return null;
  try {
    const parsed: unknown = JSON.parse(decoded);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as SessionListCursor).completedAt === "string" &&
      typeof (parsed as SessionListCursor).sessionId === "string"
    ) {
      return {
        completedAt: (parsed as SessionListCursor).completedAt,
        sessionId: (parsed as SessionListCursor).sessionId,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** `dataVersion` (D367 decision 6): opaque per (player, game) token over the terminal-session population. */
export function encodeDataVersion(input: {
  count: number;
  maxCompletedAt: string | null;
}): string {
  const maxMs =
    input.maxCompletedAt === null ? 0 : Date.parse(input.maxCompletedAt);
  return toBase64Url(`v1:${input.count}:${maxMs}`);
}
