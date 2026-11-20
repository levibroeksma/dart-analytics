import { describe, expect, it } from "vitest";
import {
  doubleRows,
  rangeRows,
  routeRows,
} from "@lib/stats/checkout/checkout-cards";

const bucket = <M>(metrics: M) => ({
  start: "a",
  end: "b",
  closed: true,
  sampleSize: 1,
  metrics,
});

const series = <M>(metrics: M) => ({
  sectionId: "double-performance",
  sectionVersion: 1,
  dataVersion: "v1",
  bucket: "none" as const,
  tz: null,
  range: { from: "a", to: "b" },
  buckets: [bucket(metrics)],
});

const ladder = (targets: Record<string, [number, number]>) => [
  bucket({
    targets: Object.fromEntries(
      Object.entries(targets).map(([k, [attempts, successes]]) => [
        k,
        { attempts, successes },
      ]),
    ),
    maxTarget: null,
    afterMiss: 0,
    recovered: 0,
  }),
];

describe("rangeRows", () => {
  it("labels the bands from the start score with one below it", () => {
    const rows = rangeRows(
      ladder({ "2": [10, 5], "45": [12, 6], "165": [9, 3] }),
      41,
    );
    expect(rows).toEqual([
      { label: "2–40", count: 10, cells: ["5", "50.0%"] },
      { label: "41–60", count: 12, cells: ["6", "50.0%"] },
      { label: "161–170", count: 9, cells: ["3", "—"] },
    ]);
  });

  it("starts 121 at 121 and never passes 170", () => {
    const rows = rangeRows(ladder({ "121": [10, 5], "170": [10, 1] }), 121);
    expect(rows.map((r) => r.label)).toEqual(["121–140", "161–170"]);
  });
});

describe("doubleRows", () => {
  it("labels doubles, most darts first, and gates the rate at 10 darts", () => {
    const rows = doubleRows(
      series({
        "DOUBLE:20": { attempts: 12, hits: 6 },
        "DOUBLE:16": { attempts: 40, hits: 10 },
        "DOUBLE:8": { attempts: 9, hits: 9 },
      }),
    );
    expect(rows).toEqual([
      { label: "D16", count: 40, cells: ["25.0%"] },
      { label: "D20", count: 12, cells: ["50.0%"] },
      { label: "D8", count: 9, cells: ["—"] },
    ]);
  });
});

describe("routeRows", () => {
  const paths = {
    "40": {
      "S20 D10": { visits: 2, finished: 1 },
      D20: { visits: 5, finished: 3 },
    },
  };

  it("lists the chosen target's routes, most used first", () => {
    expect(routeRows(paths, 40)).toEqual([
      { label: "D20", count: 5, cells: ["3", "60.0%"] },
      { label: "S20 D10", count: 2, cells: ["1", "50.0%"] },
    ]);
  });

  it("is empty with no target", () => {
    expect(routeRows(paths, null)).toEqual([]);
  });
});
