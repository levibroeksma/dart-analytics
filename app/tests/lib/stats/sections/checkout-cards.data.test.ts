import { beforeEach, describe, expect, it, vi } from "vitest";
import { heatmapWindow } from "@lib/stats/sections/score-trend-window";

const loadGameSection = vi.fn();
vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { checkoutCardsSection } =
  await import("@lib/stats/sections/checkout-cards.data");

const NOW = new Date("2026-11-17T12:00:00Z");

function series<M>(metrics: M) {
  return {
    sectionId: "x",
    sectionVersion: 1,
    dataVersion: "v1",
    bucket: "none",
    tz: null,
    range: { from: "a", to: "b" },
    buckets: [{ start: "a", end: "b", closed: true, sampleSize: 1, metrics }],
  };
}

const LADDER = {
  targets: { "41": { attempts: 12, successes: 6 } },
  maxTarget: 41,
  afterMiss: 0,
  recovered: 0,
};

function respond(paths: unknown) {
  loadGameSection.mockImplementation((_game: string, sectionId: string) =>
    Promise.resolve(
      series(
        sectionId === "ladder-progress"
          ? LADDER
          : sectionId === "checkout-path"
            ? paths
            : { "DOUBLE:20": { attempts: 12, hits: 6 } },
      ),
    ),
  );
}

function scope(game = "TUOD_V1") {
  return Object.assign(checkoutCardsSection(), {
    $data: { rangeKey: "30d" as const, game, variation: 0 },
    $watch: () => {},
  });
}

describe("checkoutCardsSection", () => {
  beforeEach(() => loadGameSection.mockReset());

  it("reads three sections over the current period only", async () => {
    respond({});
    await scope().load(NOW);
    const calls = loadGameSection.mock.calls;
    expect(calls.map((c) => c[1]).sort()).toEqual([
      "checkout-path",
      "double-performance",
      "ladder-progress",
    ]);
    expect(calls.every((c) => c[0] === "TUOD")).toBe(true);
    expect(calls[0]![2]).toEqual({
      ...heatmapWindow("30d", NOW),
      bucket: "none",
    });
  });

  it("builds the range and double tables from the game's start score", async () => {
    respond({});
    const s = scope();
    await s.load(NOW);
    expect(s.card.ranges[0]!.label).toBe("41–60");
    expect(s.card.doubles[0]!.label).toBe("D20");
  });

  it("uses 121 as the start for 121", async () => {
    respond({});
    const s = scope("121_V2");
    await s.load(NOW);
    expect(loadGameSection.mock.calls[0]![0]).toBe("ONE_TWENTY_ONE");
    expect(s.card.origin).toBe(121);
  });

  it("picks the highest target and lists its routes", async () => {
    respond({
      "40": { D20: { visits: 3, finished: 1 } },
      "170": { "T20 T20 BULL": { visits: 2, finished: 0 } },
    });
    const s = scope();
    await s.load(NOW);
    expect(s.remaining).toBe(170);
    expect(s.targets.map((t) => t.value)).toEqual([170, 40]);
    expect(s.routes[0]!.label).toBe("T20 T20 BULL");
  });

  it("keeps the chosen target while it still has data and resets when it is gone", async () => {
    respond({
      "40": { D20: { visits: 3, finished: 1 } },
      "170": { "T20 T20 BULL": { visits: 2, finished: 0 } },
    });
    const s = scope();
    await s.load(NOW);
    s.remaining = 40;
    await s.load(NOW);
    expect(s.remaining).toBe(40);
    respond({ "170": { "T20 T20 BULL": { visits: 2, finished: 0 } } });
    await s.load(NOW);
    expect(s.remaining).toBe(170);
  });

  it("has no target and no routes without path data", async () => {
    respond({});
    const s = scope();
    await s.load(NOW);
    expect(s.remaining).toBeNull();
    expect(s.routes).toEqual([]);
    expect(s.error).toBeNull();
  });

  it("shows the message when a read fails", async () => {
    loadGameSection.mockImplementation((_game: string, sectionId: string) =>
      sectionId === "checkout-path"
        ? Promise.reject(new Error("range too wide"))
        : Promise.resolve(series({})),
    );
    const s = scope();
    await s.load(NOW);
    expect(s.error).toBe("range too wide");
    expect(s.card.ranges).toEqual([]);
  });

  it("makes no read for an unknown ruleset", async () => {
    const s = scope("NOPE");
    await s.load(NOW);
    expect(loadGameSection).not.toHaveBeenCalled();
  });
});
