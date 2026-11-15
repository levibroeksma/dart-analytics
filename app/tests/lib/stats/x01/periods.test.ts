import { describe, expect, it } from "vitest";
import { splitByBoundary } from "@lib/stats/x01/periods";

const bucket = (start: string, end: string) => ({
  start,
  end,
  closed: true,
  sampleSize: 1,
  metrics: {},
});

const A = bucket("2026-09-01T00:00:00.000Z", "2026-09-10T00:00:00.000Z");
const B = bucket("2026-09-10T00:00:00.000Z", "2026-09-20T00:00:00.000Z");
const C = bucket("2026-09-20T00:00:00.000Z", "2026-09-30T00:00:00.000Z");

describe("splitByBoundary", () => {
  it("puts buckets ending at or before the boundary in previous, the rest in current", () => {
    const result = splitByBoundary([A, B, C], "2026-09-20T00:00:00.000Z");
    expect(result.previous).toEqual([A, B]);
    expect(result.current).toEqual([C]);
  });

  it("returns every bucket as current when the boundary is null", () => {
    const result = splitByBoundary([A, B, C], null);
    expect(result.previous).toEqual([]);
    expect(result.current).toEqual([A, B, C]);
  });
});
