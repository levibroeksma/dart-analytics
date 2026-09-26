import {
  chunkWindows,
  mergeMetrics,
  zonedYearWindow,
} from "@lib/stats/merge-metrics";
import { openStatsDb } from "./db";
import { paramsKey } from "./keys";
import type { Bucket, SectionMeta, ServerSectionId } from "@lib/types";
import type {
  CachedSeries,
  CachedSessionPage,
  SeriesFetcher,
  StatsCacheQuery,
} from "./types";

const SECTION_RESULTS = "sectionResults";
const COVERAGE = "coverage";
const SESSION_LISTS = "sessionLists";
const META = "meta";

type CoverageRecord = {
  coveredFrom: string;
  coveredTo: string;
  dataVersion: string;
};

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Every IndexedDB call goes through this: any throw degrades to `fallback`, never an error. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function getRecord<T>(
  db: IDBDatabase,
  store: string,
  key: string,
): Promise<T | undefined> {
  return safe(async () => {
    const tx = db.transaction(store, "readonly");
    return await idbRequest<T>(tx.objectStore(store).get(key));
  }, undefined);
}

function putRecord<T>(
  db: IDBDatabase,
  store: string,
  key: string,
  value: T,
): Promise<void> {
  return safe(async () => {
    const tx = db.transaction(store, "readwrite");
    await idbRequest(tx.objectStore(store).put(value, key));
  }, undefined);
}

function getPrefixed<T>(
  db: IDBDatabase,
  store: string,
  prefix: string,
): Promise<T[]> {
  return safe(async () => {
    const tx = db.transaction(store, "readonly");
    const range = IDBKeyRange.bound(`${prefix}:`, `${prefix}:￿`);
    return await idbRequest<T[]>(tx.objectStore(store).getAll(range));
  }, []);
}

/** Wipes every statistics cache store. Sign-out and a schema mismatch both call this. */
export async function clearStatsCache(): Promise<void> {
  const db = await openStatsDb();
  if (db === null) return;
  try {
    await safe(async () => {
      const tx = db.transaction(
        [SECTION_RESULTS, COVERAGE, SESSION_LISTS, META],
        "readwrite",
      );
      for (const store of [SECTION_RESULTS, COVERAGE, SESSION_LISTS, META]) {
        await idbRequest(tx.objectStore(store).clear());
      }
    }, undefined);
  } finally {
    db.close();
  }
}

function sectionKey(
  playerId: string,
  gameTypeKey: string,
  meta: SectionMeta,
  key: string,
): string {
  return `${playerId}:${gameTypeKey}:${meta.id}:${meta.version}:${key}`;
}

/**
 * The fetch rule (`10-Statistics/00-Overview.md` §7): a closed bucket is
 * cached forever, keyed by its own `bucket_start`; only the still-uncovered
 * span (at most two: before and after the stored coverage) is ever fetched.
 * `bucket = none` has no partial coverage — the whole result is cached
 * together and served only while `meta`'s last-known `dataVersion` for the
 * game still matches the cached response's own.
 */
export async function readSection<M>(
  playerId: string,
  gameTypeKey: string,
  meta: SectionMeta,
  q: StatsCacheQuery,
  fetcher: SeriesFetcher<M>,
  now: Date = new Date(),
): Promise<CachedSeries<M>> {
  const db = await openStatsDb();
  if (db === null) return fetcher({ from: q.from, to: q.to });

  try {
    const key = sectionKey(playerId, gameTypeKey, meta, paramsKey(q));
    if (meta.computeSite === "server") {
      return await readServerSection(db, meta, key, q, fetcher, now);
    }
    if (q.bucket === "none") {
      return await readNoneBucketSection(
        db,
        playerId,
        gameTypeKey,
        key,
        q,
        fetcher,
      );
    }
    return await readBucketedSection(db, meta, key, q, fetcher);
  } finally {
    db.close();
  }
}

async function readNoneBucketSection<M>(
  db: IDBDatabase,
  playerId: string,
  gameTypeKey: string,
  key: string,
  q: StatsCacheQuery,
  fetcher: SeriesFetcher<M>,
): Promise<CachedSeries<M>> {
  const resultKey = `${key}:${q.from}:${q.to}`;
  const dataVersionKey = `dataVersion:${playerId}:${gameTypeKey}`;

  const [cached, latestDataVersion] = await Promise.all([
    getRecord<CachedSeries<M>>(db, SECTION_RESULTS, resultKey),
    getRecord<string>(db, META, dataVersionKey),
  ]);
  if (
    cached !== undefined &&
    latestDataVersion !== undefined &&
    cached.dataVersion === latestDataVersion
  ) {
    return cached;
  }

  const response = await fetcher({ from: q.from, to: q.to });
  await Promise.all([
    putRecord(db, SECTION_RESULTS, resultKey, response),
    putRecord(db, META, dataVersionKey, response.dataVersion),
  ]);
  return response;
}

type MissingSpan = { from: string; to: string };

type CoverageState = {
  coveredFrom: string | null;
  coveredTo: string | null;
  dataVersion: string;
};

function initCoverageState(
  coverage: CoverageRecord | undefined,
): CoverageState {
  if (coverage === undefined) {
    return { coveredFrom: null, coveredTo: null, dataVersion: "" };
  }
  return {
    coveredFrom: coverage.coveredFrom,
    coveredTo: coverage.coveredTo,
    dataVersion: coverage.dataVersion,
  };
}

/** The coverage record to persist after fetching, or `null` when nothing was fetched or nothing closed yet. */
function coverageRecordToPersist(
  missing: MissingSpan[],
  state: CoverageState,
): CoverageRecord | null {
  if (missing.length === 0) return null;
  if (state.coveredFrom === null || state.coveredTo === null) return null;
  return {
    coveredFrom: state.coveredFrom,
    coveredTo: state.coveredTo,
    dataVersion: state.dataVersion,
  };
}

/** The requested `[from, to)` minus the stored coverage: at most a before-span and an after-span. */
export function missingSpans(
  q: StatsCacheQuery,
  coverage: CoverageRecord | undefined,
): MissingSpan[] {
  if (coverage === undefined) return [{ from: q.from, to: q.to }];
  const spans: MissingSpan[] = [];
  if (q.from < coverage.coveredFrom) {
    spans.push({ from: q.from, to: coverage.coveredFrom });
  }
  if (q.to > coverage.coveredTo) {
    spans.push({ from: coverage.coveredTo, to: q.to });
  }
  return spans;
}

/** Fetches one missing span, persists its closed buckets, and widens the coverage state to include it. */
async function fetchMissingSpan<M>(
  db: IDBDatabase,
  key: string,
  span: MissingSpan,
  state: CoverageState,
  fetcher: SeriesFetcher<M>,
): Promise<{ state: CoverageState; openBuckets: CachedSeries<M>["buckets"] }> {
  const response = await fetcher(span);
  const closed = response.buckets.filter((bucket) => bucket.closed);
  const openBuckets = response.buckets.filter((bucket) => !bucket.closed);

  for (const bucket of closed) {
    await putRecord(db, SECTION_RESULTS, `${key}:${bucket.start}`, bucket);
  }

  const coveredFrom =
    state.coveredFrom === null || response.range.from < state.coveredFrom
      ? response.range.from
      : state.coveredFrom;
  const lastClosedEnd = closed.at(-1)?.end;
  const coveredTo =
    lastClosedEnd !== undefined &&
    (state.coveredTo === null || lastClosedEnd > state.coveredTo)
      ? lastClosedEnd
      : state.coveredTo;

  return {
    state: { coveredFrom, coveredTo, dataVersion: response.dataVersion },
    openBuckets,
  };
}

/** The stored closed buckets in range, plus the fresh open ones, in bucket-start order. */
async function assembleBuckets<M>(
  db: IDBDatabase,
  key: string,
  q: StatsCacheQuery,
  openBuckets: CachedSeries<M>["buckets"],
): Promise<CachedSeries<M>["buckets"]> {
  const stored = await getPrefixed<CachedSeries<M>["buckets"][number]>(
    db,
    SECTION_RESULTS,
    key,
  );
  const inRange = stored.filter(
    (bucket) => bucket.start >= q.from && bucket.start < q.to,
  );
  return [...inRange, ...openBuckets].sort((a, b) =>
    a.start.localeCompare(b.start),
  );
}

async function readBucketedSection<M>(
  db: IDBDatabase,
  meta: SectionMeta,
  key: string,
  q: StatsCacheQuery,
  fetcher: SeriesFetcher<M>,
): Promise<CachedSeries<M>> {
  const coverage = await getRecord<CoverageRecord>(db, COVERAGE, key);
  const missing = missingSpans(q, coverage);

  let state = initCoverageState(coverage);
  let openBuckets: CachedSeries<M>["buckets"] = [];

  for (const span of missing) {
    const result = await fetchMissingSpan(db, key, span, state, fetcher);
    state = result.state;
    if (span.to === q.to) openBuckets = result.openBuckets;
  }

  const toPersist = coverageRecordToPersist(missing, state);
  if (toPersist !== null) await putRecord(db, COVERAGE, key, toPersist);

  const buckets = await assembleBuckets(db, key, q, openBuckets);
  const tz = q.tz === undefined ? null : q.tz;

  return {
    sectionId: meta.id,
    sectionVersion: meta.version,
    dataVersion: state.dataVersion,
    bucket: q.bucket,
    tz,
    range: { from: q.from, to: q.to },
    buckets,
  };
}

/** Merges two chunks of one server section's metrics, dispatching on its own id (phase-3 Task 9's `mergeMetrics`). */
function combineMetrics(sectionId: string, a: unknown, b: unknown): unknown {
  return mergeMetrics(sectionId as ServerSectionId, a as never, b as never);
}

/** The chunk-cache key for one server section's request bucket and window start. */
function chunkKey(
  sectionKeyValue: string,
  requestBucket: Bucket,
  windowFrom: string,
): string {
  return `${sectionKeyValue}:chunk:${requestBucket}:${windowFrom}`;
}

/**
 * `bucket = none`'s single aggregate bucket, folded across every chunk that
 * held data (phase-3 decision 2): metrics sum via `mergeMetrics`, sample
 * sizes sum, and the result is closed only once every contributing chunk is.
 * `[]` when no chunk held any data — the shared "empty buckets are not
 * emitted" convention (`00-Overview.md` §5.2).
 */
function mergeNoneChunks<M>(
  sectionId: string,
  chunks: readonly CachedSeries<M>[],
): CachedSeries<M>["buckets"] {
  const withData = chunks.filter((chunk) => chunk.buckets.length > 0);
  const first = withData[0]?.buckets[0];
  if (first === undefined) return [];

  let end = first.end;
  let sampleSize = first.sampleSize;
  let closed = first.closed;
  let metrics: unknown = first.metrics;

  for (const chunk of withData.slice(1)) {
    const bucket = chunk.buckets[0]!;
    metrics = combineMetrics(sectionId, metrics, bucket.metrics);
    sampleSize += bucket.sampleSize;
    closed = closed && bucket.closed;
    if (bucket.end > end) end = bucket.end;
  }

  return [
    { start: first.start, end, closed, sampleSize, metrics },
  ] as CachedSeries<M>["buckets"];
}

/**
 * A `year` view's client regroup of its month chunks (decision 2): each
 * month chunk's own window decides which calendar year (in `tz`) it folds
 * into, then `mergeMetrics` sums same-year months together. A year with no
 * data in any of its months is omitted, matching every other section's
 * "empty buckets are not emitted" rule.
 */
function regroupMonthsIntoYears<M>(
  sectionId: string,
  windows: readonly { from: string; to: string }[],
  chunks: readonly CachedSeries<M>[],
  tz: string,
): CachedSeries<M>["buckets"] {
  const groups = new Map<
    string,
    { end: string; sampleSize: number; closed: boolean; metrics: unknown }
  >();

  chunks.forEach((chunk, index) => {
    const bucket = chunk.buckets[0];
    if (bucket === undefined) return;
    const window = windows[index]!;
    const yearWindow = zonedYearWindow(window.from, tz);
    const existing = groups.get(yearWindow.from);
    if (existing === undefined) {
      groups.set(yearWindow.from, {
        end: yearWindow.to,
        sampleSize: bucket.sampleSize,
        closed: bucket.closed,
        metrics: bucket.metrics,
      });
      return;
    }
    existing.sampleSize += bucket.sampleSize;
    existing.closed = existing.closed && bucket.closed;
    existing.metrics = combineMetrics(
      sectionId,
      existing.metrics,
      bucket.metrics,
    );
  });

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([start, group]) => ({
      start,
      end: group.end,
      closed: group.closed,
      sampleSize: group.sampleSize,
      metrics: group.metrics,
    })) as CachedSeries<M>["buckets"];
}

/**
 * `readSection`'s path for a server-computed section (`00-Overview.md` §4,
 * phase-3 decision 2): the request splits into `chunkWindows`, each chunk is
 * read from the cache or fetched on its own (never in parallel — one Worker
 * fold at a time), and a chunk whose window has fully elapsed is cached
 * forever, exactly like a closed bucket. A `year` view fetches its chunks at
 * `month` granularity and regroups them client-side; `none` merges every
 * chunk into the single requested bucket; `day`/`week`/`month` chunks equal
 * the requested bucket already, so their buckets are just concatenated. A
 * `VALIDATION_FAILED` from the fetcher (the dart cap, `00-Overview.md` §4)
 * propagates as a rejected promise — this never retries with a smaller
 * window.
 */
async function readServerSection<M>(
  db: IDBDatabase,
  meta: SectionMeta,
  key: string,
  q: StatsCacheQuery,
  fetcher: SeriesFetcher<M>,
  now: Date,
): Promise<CachedSeries<M>> {
  const tz = q.tz ?? "UTC";
  const windows = chunkWindows(q.from, q.to, q.bucket, tz);
  const requestBucket: Bucket = q.bucket === "year" ? "month" : q.bucket;

  const cached = await Promise.all(
    windows.map((window) =>
      getRecord<CachedSeries<M>>(
        db,
        SECTION_RESULTS,
        chunkKey(key, requestBucket, window.from),
      ),
    ),
  );

  const chunks: CachedSeries<M>[] = [];
  let dataVersion = "";
  for (let index = 0; index < windows.length; index += 1) {
    const cachedChunk = cached[index];
    if (cachedChunk !== undefined) {
      chunks.push(cachedChunk);
      dataVersion = cachedChunk.dataVersion;
      continue;
    }
    const window = windows[index]!;
    const response = await fetcher({
      from: window.from,
      to: window.to,
      bucket: requestBucket,
    });
    dataVersion = response.dataVersion;
    if (Date.parse(window.to) <= now.getTime()) {
      await putRecord(
        db,
        SECTION_RESULTS,
        chunkKey(key, requestBucket, window.from),
        response,
      );
    }
    chunks.push(response);
  }

  const buckets =
    q.bucket === "none"
      ? mergeNoneChunks(meta.id, chunks)
      : q.bucket === "year"
        ? regroupMonthsIntoYears(meta.id, windows, chunks, tz)
        : chunks
            .flatMap((chunk) => chunk.buckets)
            .sort((a, b) => a.start.localeCompare(b.start));

  return {
    sectionId: meta.id,
    sectionVersion: meta.version,
    dataVersion,
    bucket: q.bucket,
    tz: q.bucket === "none" ? null : tz,
    range: { from: q.from, to: q.to },
    buckets,
  };
}

/** One session-list page, keyed by `(player, game, paramsKey, from, to, cursor)`; dropped when `dataVersion` changes. */
export async function readSessionPage<T>(
  playerId: string,
  gameTypeKey: string,
  q: StatsCacheQuery & { cursor?: string },
  fetcher: () => Promise<CachedSessionPage<T>>,
): Promise<CachedSessionPage<T>> {
  const db = await openStatsDb();
  if (db === null) return fetcher();

  try {
    const key = `${playerId}:${gameTypeKey}:${paramsKey(q)}:${q.from}:${q.to}:${q.cursor ?? ""}`;
    const dataVersionKey = `dataVersion:${playerId}:${gameTypeKey}`;

    const [cached, latestDataVersion] = await Promise.all([
      getRecord<CachedSessionPage<T>>(db, SESSION_LISTS, key),
      getRecord<string>(db, META, dataVersionKey),
    ]);
    if (
      cached !== undefined &&
      latestDataVersion !== undefined &&
      cached.dataVersion === latestDataVersion
    ) {
      return cached;
    }

    const response = await fetcher();
    await Promise.all([
      putRecord(db, SESSION_LISTS, key, response),
      putRecord(db, META, dataVersionKey, response.dataVersion),
    ]);
    return response;
  } finally {
    db.close();
  }
}
