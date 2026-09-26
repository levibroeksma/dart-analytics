import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  readSection,
  readSessionPage,
  clearStatsCache,
  missingSpans,
} from "@client/stats-cache/cache";
import { STATS_DB_NAME } from "@client/stats-cache/db";
import type { SectionMeta } from "@lib/types";
import type { CachedSeries } from "@client/types";

function deleteStatsDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(STATS_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const meta: SectionMeta = {
  id: "completion",
  version: 1,
  requires: [],
  computeSite: "sql",
  bucketable: true,
  includesAbandoned: true,
  configSensitive: [],
};

type Metrics = { completed: number };

function bucket(start: string, end: string, closed: boolean, completed = 1) {
  return { start, end, closed, sampleSize: completed, metrics: { completed } };
}

function response(
  from: string,
  to: string,
  buckets: ReturnType<typeof bucket>[],
  dataVersion = "v1:1:0",
): CachedSeries<Metrics> {
  return {
    sectionId: "completion",
    sectionVersion: 1,
    dataVersion,
    bucket: "month",
    tz: "Europe/Amsterdam",
    range: { from, to },
    buckets,
  };
}

const baseQuery = {
  bucket: "month" as const,
  tz: "Europe/Amsterdam",
  context: "all" as const,
  inputMode: "VISUAL_BOARD",
  from: "2026-01-01T00:00:00.000Z",
  to: "2026-04-01T00:00:00.000Z",
};

describe("readSection (bucketed)", () => {
  beforeEach(() => deleteStatsDb());

  it("fetches the whole range on the first read and stores the closed buckets", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response("2026-01-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", [
          bucket("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", true),
          bucket("2026-02-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z", true),
          bucket("2026-03-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", false),
        ]),
      );

    const result = await readSection("p1", "501", meta, baseQuery, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith({
      from: baseQuery.from,
      to: baseQuery.to,
    });
    expect(result.buckets).toHaveLength(3);
  });

  it("a second identical read fetches only the still-open tail", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response("2026-01-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", [
          bucket("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", true),
          bucket("2026-02-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z", true),
          bucket("2026-03-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", false),
        ]),
      );

    await readSection("p1", "501", meta, baseQuery, fetcher);
    fetcher.mockClear();
    fetcher.mockResolvedValue(
      response("2026-03-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", [
        bucket("2026-03-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", true),
      ]),
    );

    const result = await readSection("p1", "501", meta, baseQuery, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith({
      from: "2026-03-01T00:00:00.000Z",
      to: baseQuery.to,
    });
    expect(result.buckets.every((b) => b.closed)).toBe(true);
    expect(result.buckets).toHaveLength(3);
  });

  it("widening from earlier fetches only the earlier span", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response("2026-02-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", [
          bucket("2026-02-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z", true),
          bucket("2026-03-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", true),
        ]),
      );
    await readSection(
      "p1",
      "501",
      meta,
      { ...baseQuery, from: "2026-02-01T00:00:00.000Z" },
      fetcher,
    );
    fetcher.mockClear();
    fetcher.mockResolvedValue(
      response("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", [
        bucket("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", true),
      ]),
    );

    const result = await readSection("p1", "501", meta, baseQuery, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith({
      from: baseQuery.from,
      to: "2026-02-01T00:00:00.000Z",
    });
    expect(result.buckets).toHaveLength(3);
  });

  it("misses the cache when the section version bumps", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response(baseQuery.from, baseQuery.to, [
          bucket("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", true),
        ]),
      );
    await readSection("p1", "501", meta, baseQuery, fetcher);
    fetcher.mockClear();
    fetcher.mockResolvedValue(
      response(baseQuery.from, baseQuery.to, [
        bucket("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", true),
      ]),
    );

    await readSection("p1", "501", { ...meta, version: 2 }, baseQuery, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("calls the fetcher every time when IndexedDB is unavailable and still returns data", async () => {
    const original = globalThis.indexedDB;
    // @ts-expect-error simulating an environment without IndexedDB
    delete globalThis.indexedDB;
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response(baseQuery.from, baseQuery.to, [
          bucket("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", true),
        ]),
      );

    await readSection("p1", "501", meta, baseQuery, fetcher);
    const result = await readSection("p1", "501", meta, baseQuery, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.buckets).toHaveLength(1);
    globalThis.indexedDB = original;
  });
});

describe("readSection (bucket=none)", () => {
  beforeEach(() => deleteStatsDb());

  const noneQuery = {
    bucket: "none" as const,
    context: "all" as const,
    inputMode: "VISUAL_BOARD",
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-04-01T00:00:00.000Z",
  };

  it("serves from the cache when the data version has not changed", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response(noneQuery.from, noneQuery.to, [
          bucket(noneQuery.from, noneQuery.to, true, 5),
        ]),
      );

    await readSection("p1", "501", meta, noneQuery, fetcher);
    const second = await readSection("p1", "501", meta, noneQuery, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(second.dataVersion).toBe("v1:1:0");
  });

  it("refetches once the data version changes", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response(noneQuery.from, noneQuery.to, [
          bucket(noneQuery.from, noneQuery.to, true, 5),
        ]),
      )
      .mockResolvedValueOnce(
        response(
          noneQuery.from,
          noneQuery.to,
          [bucket(noneQuery.from, noneQuery.to, true, 6)],
          "v1:2:0",
        ),
      );

    await readSection("p1", "501", meta, noneQuery, fetcher);
    await readSection("p1", "other-game", meta, noneQuery, fetcher);
    const third = await readSection("p1", "501", meta, noneQuery, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(third.dataVersion).toBe("v1:1:0");
  });
});

describe("readSessionPage", () => {
  beforeEach(() => deleteStatsDb());

  it("caches a page and serves it while dataVersion is unchanged", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      items: [{ id: "s1" }],
      nextCursor: null,
      dataVersion: "v1",
    });

    const first = await readSessionPage(
      "p1",
      "501",
      {
        bucket: "none",
        context: "all",
        inputMode: "VISUAL_BOARD",
        from: "a",
        to: "b",
      },
      fetcher,
    );
    const second = await readSessionPage(
      "p1",
      "501",
      {
        bucket: "none",
        context: "all",
        inputMode: "VISUAL_BOARD",
        from: "a",
        to: "b",
      },
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });
});

describe("clearStatsCache", () => {
  beforeEach(() => deleteStatsDb());

  it("empties every store", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response(baseQuery.from, baseQuery.to, [
          bucket("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", true),
        ]),
      );
    await readSection("p1", "501", meta, baseQuery, fetcher);

    await clearStatsCache();
    fetcher.mockClear();
    await readSection("p1", "501", meta, baseQuery, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith({
      from: baseQuery.from,
      to: baseQuery.to,
    });
  });
});

describe("missingSpans", () => {
  it("returns the whole requested range when there is no coverage yet", () => {
    expect(missingSpans({ ...baseQuery }, undefined)).toEqual([
      { from: baseQuery.from, to: baseQuery.to },
    ]);
  });

  it("returns nothing when the requested range is already fully covered", () => {
    const coverage = {
      coveredFrom: baseQuery.from,
      coveredTo: baseQuery.to,
      dataVersion: "v1",
    };
    expect(missingSpans({ ...baseQuery }, coverage)).toEqual([]);
  });

  it("returns only the trailing span when the tail is still open", () => {
    const coverage = {
      coveredFrom: baseQuery.from,
      coveredTo: "2026-03-01T00:00:00.000Z",
      dataVersion: "v1",
    };
    expect(missingSpans({ ...baseQuery }, coverage)).toEqual([
      { from: "2026-03-01T00:00:00.000Z", to: baseQuery.to },
    ]);
  });

  it("returns only the leading span when widening from earlier", () => {
    const coverage = {
      coveredFrom: "2026-02-01T00:00:00.000Z",
      coveredTo: baseQuery.to,
      dataVersion: "v1",
    };
    expect(missingSpans({ ...baseQuery }, coverage)).toEqual([
      { from: baseQuery.from, to: "2026-02-01T00:00:00.000Z" },
    ]);
  });

  it("returns both spans when widening earlier while the tail is still open", () => {
    const coverage = {
      coveredFrom: "2026-02-01T00:00:00.000Z",
      coveredTo: "2026-03-01T00:00:00.000Z",
      dataVersion: "v1",
    };
    expect(missingSpans({ ...baseQuery }, coverage)).toEqual([
      { from: baseQuery.from, to: "2026-02-01T00:00:00.000Z" },
      { from: "2026-03-01T00:00:00.000Z", to: baseQuery.to },
    ]);
  });
});
