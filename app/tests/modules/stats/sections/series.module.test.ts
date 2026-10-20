import { describe, it, expect } from "vitest";
import {
  closeBuckets,
  isClosed,
  encodeCursor,
  decodeCursor,
  encodeDataVersion,
} from "@modules/stats/sections/series.module";

describe("isClosed", () => {
  it("is closed when the bucket ends exactly at now", () => {
    const now = new Date("2026-06-15T00:00:00.000Z");
    expect(
      isClosed("2026-06-15T00:00:00.000Z", "2026-12-01T00:00:00.000Z", now),
    ).toBe(true);
  });

  it("is closed when the bucket ends exactly at the requested to", () => {
    const now = new Date("2026-12-01T00:00:00.000Z");
    expect(
      isClosed("2026-06-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z", now),
    ).toBe(true);
  });

  it("is open when the bucket ends after both to and now", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    expect(
      isClosed("2026-07-01T00:00:00.000Z", "2026-07-01T00:00:00.000Z", now),
    ).toBe(false);
  });
});

describe("cursor codec", () => {
  it("round-trips", () => {
    const cursor = { completedAt: "2026-01-01T00:00:00.000Z", sessionId: "s1" };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("returns null on malformed input", () => {
    expect(decodeCursor("%%%")).toBeNull();
  });

  it("returns null on a well-formed but wrong-shaped payload", () => {
    expect(
      decodeCursor(encodeCursor({ completedAt: "x" } as never)),
    ).toBeNull();
  });
});

describe("data version codec", () => {
  it("is stable for equal input", () => {
    const input = { count: 5, maxCompletedAt: "2026-01-01T00:00:00.000Z" };
    expect(encodeDataVersion(input)).toBe(encodeDataVersion({ ...input }));
  });

  it("changes when the count changes", () => {
    const a = encodeDataVersion({
      count: 5,
      maxCompletedAt: "2026-01-01T00:00:00.000Z",
    });
    const b = encodeDataVersion({
      count: 6,
      maxCompletedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(a).not.toBe(b);
  });
});

describe("closeBuckets", () => {
  const ctx = {
    to: "2026-12-01T00:00:00.000Z",
    now: new Date("2026-06-15T00:00:00.000Z"),
  };

  it("sorts buckets by start and stamps closure and sample size", () => {
    const buckets = new Map([
      [
        "2026-06-08",
        { end: "2026-06-15T00:00:00.000Z", metrics: { n: 2 }, sampleSize: 2 },
      ],
      [
        "2026-06-01",
        { end: "2026-06-08T00:00:00.000Z", metrics: { n: 1 }, sampleSize: 1 },
      ],
      [
        "2026-06-15",
        { end: "2026-06-22T00:00:00.000Z", metrics: { n: 3 }, sampleSize: 3 },
      ],
    ]);
    expect(closeBuckets(buckets, ctx)).toEqual([
      {
        start: "2026-06-01",
        end: "2026-06-08T00:00:00.000Z",
        closed: true,
        sampleSize: 1,
        metrics: { n: 1 },
      },
      {
        start: "2026-06-08",
        end: "2026-06-15T00:00:00.000Z",
        closed: true,
        sampleSize: 2,
        metrics: { n: 2 },
      },
      {
        start: "2026-06-15",
        end: "2026-06-22T00:00:00.000Z",
        closed: false,
        sampleSize: 3,
        metrics: { n: 3 },
      },
    ]);
  });

  it("keeps empty buckets by default", () => {
    const buckets = new Map([
      [
        "2026-06-01",
        { end: "2026-06-08T00:00:00.000Z", metrics: {}, sampleSize: 0 },
      ],
    ]);
    expect(closeBuckets(buckets, ctx)).toHaveLength(1);
  });

  it("drops buckets with no samples when dropEmpty is set", () => {
    const buckets = new Map([
      [
        "2026-06-01",
        { end: "2026-06-08T00:00:00.000Z", metrics: {}, sampleSize: 0 },
      ],
      [
        "2026-06-08",
        { end: "2026-06-15T00:00:00.000Z", metrics: {}, sampleSize: 4 },
      ],
    ]);
    expect(
      closeBuckets(buckets, ctx, { dropEmpty: true }).map((b) => b.start),
    ).toEqual(["2026-06-08"]);
  });
});
