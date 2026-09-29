import type {
  Bucket,
  ContextFilter,
  GameTypeKey,
  SeriesBucket,
} from "@lib/types";
import type { DartExerciseKind } from "@modules/types";

/** The non-range request parameters `paramsKey` hashes. */
export type StatsCacheParams = {
  bucket: Bucket;
  tz?: string;
  status?: string;
  context: ContextFilter;
  inputMode: string;
  target?: string;
};

/**
 * The scope `readSection`/`readSessionPage` key and resolve compute-site
 * against (controller rulings R4/R22/R23): `key` partitions the cache (a
 * game page's `gameScopeKey`, a routine or step page's `routineScopeKey`/
 * `stepScopeKey`), while `gameTypeKey` — `null` for a routine/step scope
 * outside a GAME step — is what `sectionSite` resolves against, since a
 * scope's own `key` is never itself a real `GameTypeKey`. `exerciseKind` is
 * set only for a non-game step's `step-result` read, whose chunk merge
 * needs its own dart exercise kind's spec. `versionKey` defaults to `key`;
 * a routine or step scope sets it to `routineScopeKey(routineKey)` so every
 * surface of one routine shares the single `dataVersion` token migration
 * `0045`'s views compute for it (plan decision 12) — a step's own results
 * go stale the moment the routine's token changes, even though the step
 * was never fetched directly.
 */
export type CacheScope = {
  key: string;
  gameTypeKey: GameTypeKey | null;
  exerciseKind?: DartExerciseKind;
  versionKey?: string;
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
  /**
   * The count of sessions a server-computed section's fold could not replay
   * (`00-Overview.md` §4, phase-4 decision 4), summed across every chunk a
   * server-site `readSection` fetched. Absent on a `sql`-site result, which
   * never sets it.
   */
  skippedSessions?: number;
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
