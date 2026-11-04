import type {
  BucketedSession,
  SessionListCursor,
  StagedVisit,
} from "@modules/types";
import type { SeriesBucket } from "@lib/types";

/**
 * Shared, pure helpers every section module uses: bucket closure
 * (`10-Statistics/00-Overview.md` §5.2), the session-list cursor codec, and
 * the `dataVersion` codec (D367 decision 6). No I/O; isomorphic.
 * `toBase64Url`/`fromBase64Url` are exported for `replay.module.ts`'s cursor
 * codec too (R2, D371) — the only base64url codec in `modules/stats`.
 */

/** Base64url encodes `input`, stripped of `=` padding (RFC 4648 §5). */
export function toBase64Url(input: string): string {
  return btoa(input)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/** Base64url decodes `input`; `null` for anything outside the base64url alphabet or that fails to decode. */
export function fromBase64Url(input: string): string | null {
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

/**
 * Gets or creates the start-keyed accumulator `row` falls in: a new one takes
 * the row's `bucketEnd`, no samples and `emptyMetrics()`. The caller mutates
 * the returned accumulator in place.
 */
export function bucketFor<M>(
  buckets: Map<string, { end: string; sampleSize: number; metrics: M }>,
  row: { bucketStart: string; bucketEnd: string },
  emptyMetrics: () => NoInfer<M>,
): { end: string; sampleSize: number; metrics: M } {
  const existing = buckets.get(row.bucketStart);
  if (existing) return existing;
  const created = {
    end: row.bucketEnd,
    sampleSize: 0,
    metrics: emptyMetrics(),
  };
  buckets.set(row.bucketStart, created);
  return created;
}

/**
 * Turns a section's start-keyed accumulators into its ordered series:
 * sorted by bucket start, each stamped with closure. `dropEmpty` omits buckets
 * that took no sample.
 */
export function closeBuckets<M>(
  buckets: ReadonlyMap<string, { end: string; sampleSize: number; metrics: M }>,
  ctx: { to: string; now: Date },
  options: { dropEmpty?: boolean } = {},
): SeriesBucket<M>[] {
  return Array.from(buckets.entries())
    .filter(([, bucket]) => !options.dropEmpty || bucket.sampleSize > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([start, bucket]) => ({
      start,
      end: bucket.end,
      closed: isClosed(bucket.end, ctx.to, ctx.now),
      sampleSize: bucket.sampleSize,
      metrics: bucket.metrics,
    }));
}

/**
 * Folds sessions' visits into start-keyed buckets of keyed entries: every
 * session opens its bucket, each visit `include` admits gets-or-creates the
 * entry at `keyOf(visit)` from `empty()`, is passed to `add`, and counts one
 * sample. Buckets with no sample are dropped.
 */
export function visitBuckets<E>(
  sessions: readonly BucketedSession[],
  ctx: { to: string; now: Date },
  spec: {
    include: (visit: StagedVisit) => boolean;
    keyOf: (visit: StagedVisit) => string;
    empty: () => E;
    add: (entry: E, visit: StagedVisit) => void;
  },
): SeriesBucket<Record<string, E>>[] {
  const buckets = new Map<
    string,
    { end: string; sampleSize: number; metrics: Record<string, E> }
  >();
  for (const session of sessions) {
    const bucket = bucketFor(buckets, session, () => ({}));
    for (const visit of session.visits) {
      if (!spec.include(visit)) continue;
      const key = spec.keyOf(visit);
      const entry = bucket.metrics[key] ?? spec.empty();
      spec.add(entry, visit);
      bucket.metrics[key] = entry;
      bucket.sampleSize += 1;
    }
  }
  return closeBuckets(buckets, ctx, { dropEmpty: true });
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
