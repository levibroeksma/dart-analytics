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

async function readBucketedSection<M>(
  db: IDBDatabase,
  meta: SectionMeta,
  key: string,
  q: StatsCacheQuery,
  fetcher: SeriesFetcher<M>,
): Promise<CachedSeries<M>> {
  const coverage = await getRecord<CoverageRecord>(db, COVERAGE, key);

  const missing: { from: string; to: string }[] = [];
  if (coverage === undefined) {
    missing.push({ from: q.from, to: q.to });
  } else {
    if (q.from < coverage.coveredFrom) {
      missing.push({ from: q.from, to: coverage.coveredFrom });
    }
    if (q.to > coverage.coveredTo) {
      missing.push({ from: coverage.coveredTo, to: q.to });
    }
  }

  let coveredFrom = coverage?.coveredFrom ?? null;
  let coveredTo = coverage?.coveredTo ?? null;
  let dataVersion = coverage?.dataVersion ?? "";
  let openBuckets: CachedSeries<M>["buckets"] = [];

  for (const span of missing) {
    const response = await fetcher(span);
    dataVersion = response.dataVersion;
    const closed = response.buckets.filter((bucket) => bucket.closed);
    if (span.to === q.to) {
      openBuckets = response.buckets.filter((bucket) => !bucket.closed);
    }

    for (const bucket of closed) {
      await putRecord(db, SECTION_RESULTS, `${key}:${bucket.start}`, bucket);
    }

    if (coveredFrom === null || response.range.from < coveredFrom) {
      coveredFrom = response.range.from;
    }
    const lastClosedEnd = closed.at(-1)?.end;
    if (
      lastClosedEnd !== undefined &&
      (coveredTo === null || lastClosedEnd > coveredTo)
    ) {
      coveredTo = lastClosedEnd;
    }
  }

  if (missing.length > 0 && coveredFrom !== null && coveredTo !== null) {
    await putRecord<CoverageRecord>(db, COVERAGE, key, {
      coveredFrom,
      coveredTo,
      dataVersion,
    });
  }

  const stored = await getPrefixed<CachedSeries<M>["buckets"][number]>(
    db,
    SECTION_RESULTS,
    key,
  );
  const inRange = stored.filter(
    (bucket) => bucket.start >= q.from && bucket.start < q.to,
  );
  const buckets = [...inRange, ...openBuckets].sort((a, b) =>
    a.start.localeCompare(b.start),
  );

  return {
    sectionId: meta.id,
    sectionVersion: meta.version,
    dataVersion,
    bucket: q.bucket,
    tz: q.tz ?? null,
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
