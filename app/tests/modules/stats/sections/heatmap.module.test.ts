import { describe, it, expect } from "vitest";
import {
  HEATMAP_CELL_MM,
  heatmapBuckets,
  heatmapCellRowsFromAims,
} from "@modules/stats/sections/heatmap.module";
import { sessionSteps } from "@modules/stats/derived-aims.module";
import type { DartFoldRow, HeatmapCellRow } from "@modules/types";

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

const SHANGHAI_SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "HOME",
    participantTypeKey: "PLAYER",
  },
];

function shanghaiDart(
  turn: number,
  dart: number,
  total: number,
  x: number,
  y: number,
): DartFoldRow {
  return {
    sessionId: "s-shanghai",
    gameTypeKey: "SHANGHAI",
    rulesetVersionKey: "SHANGHAI_V1",
    configuration: { seats: SHANGHAI_SEATS },
    sessionDartCount: total,
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    turnSequence: turn,
    dartNumber: dart,
    hitTargetNumber: turn,
    hitZoneKey: "OUTER_SINGLE",
    intendedTargetNumber: null,
    intendedZoneKey: null,
    locationX: x,
    locationY: y,
  };
}

describe("heatmapCellRowsFromAims", () => {
  const rows = [
    shanghaiDart(1, 1, 6, -2.5, 0),
    shanghaiDart(1, 2, 6, 4.99, 0),
    shanghaiDart(1, 3, 6, 5, 0),
    shanghaiDart(2, 1, 6, 1, 1),
    shanghaiDart(2, 2, 6, 1, 1),
    shanghaiDart(2, 3, 6, 1, 1),
  ];
  const { sessions, skippedSessions } = sessionSteps(rows);

  it("replays the fixture without skipping", () => {
    expect(skippedSessions).toBe(0);
  });

  it("keeps only darts aimed at the NUMBER target, binned like SQL FLOOR", () => {
    const cells = heatmapCellRowsFromAims(sessions, {
      number: 1,
      zone: "NUMBER",
    });

    expect(cells).toEqual(
      expect.arrayContaining([
        { ix: -1, iy: 0, darts: 1 },
        { ix: 0, iy: 0, darts: 1 },
        { ix: 1, iy: 0, darts: 1 },
      ]),
    );
    expect(cells).toHaveLength(3);
  });

  it("sums darts landing in one cell", () => {
    expect(
      heatmapCellRowsFromAims(sessions, { number: 2, zone: "NUMBER" }),
    ).toEqual([{ ix: 0, iy: 0, darts: 3 }]);
  });

  it("returns no rows for a target nothing aimed at", () => {
    expect(
      heatmapCellRowsFromAims(sessions, { number: 20, zone: "NUMBER" }),
    ).toEqual([]);
    expect(
      heatmapCellRowsFromAims(sessions, { number: 25, zone: "BULL" }),
    ).toEqual([]);
  });
});
