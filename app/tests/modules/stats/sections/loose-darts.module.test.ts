import { describe, it, expect } from "vitest";
import {
  BOARD_RADII_MM,
  SECTOR_ORDER,
  SECTOR_WIDTH_DEGREES,
} from "@lib/game/board/board-geometry.module";
import {
  classifyLanding,
  looseDartsBuckets,
} from "@modules/stats/sections/loose-darts.module";
import type { IntentZoneKey } from "@lib/types";
import type { AimLanding } from "@modules/types";

function at(number: number, radius: number) {
  const bearing =
    (SECTOR_ORDER.indexOf(number) * SECTOR_WIDTH_DEGREES * Math.PI) / 180;
  return { x: radius * Math.sin(bearing), y: -radius * Math.cos(bearing) };
}

function landing(overrides: Partial<AimLanding>): AimLanding {
  return {
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    intendedTargetNumber: 16,
    intendedZoneKey: "DOUBLE",
    hitTargetNumber: 16,
    hitZoneKey: "DOUBLE",
    darts: 1,
    x: at(16, 166).x,
    y: at(16, 166).y,
    ...overrides,
  };
}

const MISS = { number: null, zone: "MISS" } as const;

const aimsBeyondEdge: {
  name: string;
  aim: { number: number; zone: IntentZoneKey };
  edge: (offset: number) => { x: number; y: number };
}[] = [
  {
    name: "DOUBLE:20",
    aim: { number: 20, zone: "DOUBLE" },
    edge: (d) => at(20, BOARD_RADII_MM.doubleOuter + d),
  },
  {
    name: "TREBLE:20",
    aim: { number: 20, zone: "TREBLE" },
    edge: (d) => at(20, BOARD_RADII_MM.trebleOuter + d),
  },
  {
    name: "INNER_SINGLE:20",
    aim: { number: 20, zone: "INNER_SINGLE" },
    edge: (d) => at(20, BOARD_RADII_MM.trebleInner + d),
  },
  {
    name: "OUTER_SINGLE:20",
    aim: { number: 20, zone: "OUTER_SINGLE" },
    edge: (d) => at(20, BOARD_RADII_MM.doubleInner + d),
  },
  {
    name: "NUMBER:20",
    aim: { number: 20, zone: "NUMBER" },
    edge: (d) => at(20, BOARD_RADII_MM.doubleOuter + d),
  },
  {
    name: "INNER_BULL:25",
    aim: { number: 25, zone: "INNER_BULL" },
    edge: (d) => ({ x: BOARD_RADII_MM.innerBull + d, y: 0 }),
  },
  {
    name: "OUTER_BULL:25",
    aim: { number: 25, zone: "OUTER_BULL" },
    edge: (d) => ({ x: BOARD_RADII_MM.outerBull + d, y: 0 }),
  },
  {
    name: "BULL:25",
    aim: { number: 25, zone: "BULL" },
    edge: (d) => ({ x: BOARD_RADII_MM.outerBull + d, y: 0 }),
  },
];

describe("classifyLanding", () => {
  for (const c of aimsBeyondEdge) {
    it(`${c.name}: 19.99 mm and 20.00 mm past the bed are near misses, 20.01 mm is loose`, () => {
      expect(classifyLanding(c.aim, MISS, c.edge(19.99))).toBe("nearMiss");
      expect(classifyLanding(c.aim, MISS, c.edge(20))).toBe("nearMiss");
      expect(classifyLanding(c.aim, MISS, c.edge(20.01))).toBe("loose");
    });
  }

  it("counts a dart 15 mm beyond the double as a near miss and 40 mm beyond as loose", () => {
    const aim = { number: 20, zone: "DOUBLE" } as const;
    expect(
      classifyLanding(aim, MISS, at(20, BOARD_RADII_MM.doubleOuter + 15)),
    ).toBe("nearMiss");
    expect(
      classifyLanding(aim, MISS, at(20, BOARD_RADII_MM.doubleOuter + 40)),
    ).toBe("loose");
  });

  it("counts a neighbouring double centre as loose when it lies more than 20 mm from the aimed double", () => {
    const aim = { number: 20, zone: "DOUBLE" } as const;
    expect(
      classifyLanding(aim, { number: 1, zone: "DOUBLE" }, at(1, 166)),
    ).toBe("loose");
  });

  it("counts a dart inside the neighbouring sector within 20 mm of the aimed double as a near miss", () => {
    const aim = { number: 20, zone: "DOUBLE" } as const;
    const bearing = (SECTOR_WIDTH_DEGREES / 2 + 2) * (Math.PI / 180);
    const justPast = {
      x: 166 * Math.sin(bearing),
      y: -166 * Math.cos(bearing),
    };
    expect(classifyLanding(aim, { number: 1, zone: "DOUBLE" }, justPast)).toBe(
      "nearMiss",
    );
  });

  it("counts a dart in the inner single within 20 mm of the outer bull as a near miss under a bull aim", () => {
    expect(
      classifyLanding(
        { number: 25, zone: "BULL" },
        { number: 20, zone: "INNER_SINGLE" },
        { x: BOARD_RADII_MM.outerBull + 5, y: 0 },
      ),
    ).toBe("nearMiss");
  });

  it("counts either bull ring as on target for a BULL aim and a hit pair as on target for a stored aim", () => {
    expect(
      classifyLanding(
        { number: 25, zone: "BULL" },
        { number: 25, zone: "INNER_BULL" },
        { x: 1, y: 1 },
      ),
    ).toBe("onTarget");
    expect(
      classifyLanding(
        { number: 16, zone: "DOUBLE" },
        { number: 16, zone: "DOUBLE" },
        at(16, 166),
      ),
    ).toBe("onTarget");
  });

  it("keeps a hit with no landing point on target", () => {
    expect(
      classifyLanding(
        { number: 16, zone: "DOUBLE" },
        { number: 16, zone: "DOUBLE" },
        null,
      ),
    ).toBe("onTarget");
  });

  it("marks a miss with no landing point unmeasured", () => {
    expect(classifyLanding({ number: 16, zone: "DOUBLE" }, MISS, null)).toBe(
      "unmeasured",
    );
  });
});

describe("looseDartsBuckets", () => {
  const ctx = {
    to: "2026-02-01T00:00:00.000Z",
    now: new Date("2026-03-01T00:00:00.000Z"),
  };

  it("partitions hit, near miss and loose darts per intended target", () => {
    const rows = [
      landing({}),
      landing({
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        ...at(16, BOARD_RADII_MM.doubleOuter + 10),
      }),
      landing({
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        ...at(16, BOARD_RADII_MM.doubleOuter + 40),
      }),
    ];

    const [bucket] = looseDartsBuckets(rows, ctx);

    expect(bucket!.metrics["DOUBLE:16"]).toEqual({
      onTarget: 1,
      nearMiss: 1,
      loose: 1,
    });
    expect(bucket!.sampleSize).toBe(3);
  });

  it("counts an unmeasured miss in sampleSize but in none of the three counts", () => {
    const rows = [
      landing({}),
      landing({
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        ...at(16, BOARD_RADII_MM.doubleOuter + 10),
      }),
      landing({
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        x: null,
        y: null,
      }),
    ];

    const [bucket] = looseDartsBuckets(rows, ctx);

    expect(bucket!.metrics["DOUBLE:16"]).toEqual({
      onTarget: 1,
      nearMiss: 1,
      loose: 0,
    });
    expect(bucket!.sampleSize).toBe(3);
  });

  it("keeps one entry per intended target", () => {
    const rows = [
      landing({}),
      landing({
        intendedTargetNumber: 20,
        intendedZoneKey: "TREBLE",
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        ...at(20, 103),
      }),
    ];

    const [bucket] = looseDartsBuckets(rows, ctx);

    expect(Object.keys(bucket!.metrics).sort()).toEqual([
      "DOUBLE:16",
      "TREBLE:20",
    ]);
  });

  it("returns no buckets for an empty row set", () => {
    expect(looseDartsBuckets([], ctx)).toEqual([]);
  });

  it("orders buckets by start ascending, folds a repeated start, and stamps closure", () => {
    const open = {
      to: "2026-03-01T00:00:00.000Z",
      now: new Date("2026-02-15T00:00:00.000Z"),
    };
    const series = looseDartsBuckets(
      [
        landing({
          bucketStart: "2026-02-01T00:00:00.000Z",
          bucketEnd: "2026-03-01T00:00:00.000Z",
        }),
        landing({}),
        landing({
          bucketStart: "2026-02-01T00:00:00.000Z",
          bucketEnd: "2026-03-01T00:00:00.000Z",
        }),
      ],
      open,
    );
    expect(
      series.map(({ start, end, closed }) => ({ start, end, closed })),
    ).toEqual([
      {
        start: "2026-01-01T00:00:00.000Z",
        end: "2026-02-01T00:00:00.000Z",
        closed: true,
      },
      {
        start: "2026-02-01T00:00:00.000Z",
        end: "2026-03-01T00:00:00.000Z",
        closed: false,
      },
    ]);
    expect(series[1]!.sampleSize).toBe(2 * series[0]!.sampleSize);
  });
});
