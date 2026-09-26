import { describe, it, expect } from "vitest";
import {
  HEATMAP_CELL_MM,
  heatmapBuckets,
} from "@modules/stats/sections/heatmap.module";
import type { HeatmapCellRow } from "@modules/types";

describe("heatmapBuckets", () => {
  const ctx = {
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-02-01T00:00:00.000Z",
    now: new Date("2026-03-01T00:00:00.000Z"),
    target: null,
  };

  it("keeps the SQL row order as tuples and echoes cellMm and target", () => {
    const rows: HeatmapCellRow[] = [
      { ix: 0, iy: 0, darts: 12 },
      { ix: 1, iy: -1, darts: 4 },
    ];

    const [bucket] = heatmapBuckets(rows, ctx);

    expect(bucket.metrics.cellMm).toBe(HEATMAP_CELL_MM);
    expect(bucket.metrics.target).toBeNull();
    expect(bucket.metrics.cells).toEqual([
      [0, 0, 12],
      [1, -1, 4],
    ]);
    expect(bucket.sampleSize).toBe(16);
  });

  it("echoes a set target", () => {
    const [bucket] = heatmapBuckets([{ ix: 0, iy: 0, darts: 1 }], {
      ...ctx,
      target: "DOUBLE:16",
    });
    expect(bucket.metrics.target).toBe("DOUBLE:16");
  });

  it("returns no buckets for an empty row set", () => {
    expect(heatmapBuckets([], ctx)).toEqual([]);
  });
});
