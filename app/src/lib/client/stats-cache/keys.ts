import type { StatsCacheParams } from "./types";

/** A stable key over a request's non-range parameters (`from`/`to` are handled by coverage, not the key). */
export function paramsKey(q: StatsCacheParams): string {
  return JSON.stringify({
    bucket: q.bucket,
    tz: q.tz ?? null,
    status: q.status ?? null,
    context: q.context,
    inputMode: q.inputMode,
    ...(q.target === undefined ? {} : { target: q.target }),
  });
}
