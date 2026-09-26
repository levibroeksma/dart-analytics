import type { Bucket, ContextFilter, SeriesBucket } from "@lib/types";

/** The non-range request parameters `paramsKey` hashes. */
export type StatsCacheParams = {
  bucket: Bucket;
  tz?: string;
  status?: string;
  context: ContextFilter;
  inputMode: string;
  target?: string;
};

/** A section request the cache reads through — the range plus `StatsCacheParams`. */
export type StatsCacheQuery = StatsCacheParams & {
  from: string;
  to: string;
};

/** The section series shape `readSection` fetches and assembles, generic over its metrics. */
export type CachedSeries<M> = {
  sectionId: string;
  sectionVersion: number;
  dataVersion: string;
  bucket: Bucket;
  tz: string | null;
  range: { from: string; to: string };
  buckets: SeriesBucket<M>[];
};

/**
 * A section series fetcher: given the still-missing sub-range, returns the
 * server's response for it. `bucket` is set only by a server-computed
 * section's chunked read (`cache.ts`), to request a chunk's own granularity
 * (`year` chunks fetch as `month`) rather than the caller's outer `bucket`.
 */
export type SeriesFetcher<M> = (range: {
  from: string;
  to: string;
  bucket?: Bucket;
}) => Promise<CachedSeries<M>>;

/** One page of `findGameSessionsPage`'s response shape, as cached client-side. */
export type CachedSessionPage<T> = {
  items: T[];
  nextCursor: string | null;
  dataVersion: string;
};
