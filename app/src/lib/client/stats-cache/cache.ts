import { openStatsDb } from "./db";
import { paramsKey } from "./keys";
import type { SectionMeta } from "@lib/types";
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
): Promise<CachedSeries<M>> {
  const db = await openStatsDb();
  if (db === null) return fetcher({ from: q.from, to: q.to });

  try {
    const key = sectionKey(playerId, gameTypeKey, meta, paramsKey(q));
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
