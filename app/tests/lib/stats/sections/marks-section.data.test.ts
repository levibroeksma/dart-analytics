import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  heatmapWindow,
  precedingWindow,
} from "@lib/stats/sections/score-trend-window";
import type { MarksMetrics } from "@modules/types";

const loadGameSection = vi.fn();
vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { marksSection } = await import("@lib/stats/sections/marks-section.data");

const NOW = new Date("2026-11-20T12:00:00Z");

function metrics(overrides: Partial<MarksMetrics> = {}): MarksMetrics {
  return {
    darts: 30,
    marks: 25,
    wasted: 6,
    rings: { single: 10, double: 5, treble: 5 },
    objectives: [
      { key: "20", marks: 3, darts: 4 },
      { key: "BULL", marks: 1, darts: 1 },
    ],
    closeOuts: { games: 0, darts: 0 },
    duel: { games: 0, wins: 0, darts: 0, points: 0 },
    ...overrides,
  };
}

function served(current: MarksMetrics, previous: MarksMetrics) {
  const from = heatmapWindow("30d", NOW).from;
  loadGameSection.mockImplementation(
    (_game: string, _id: string, range: { from: string }) =>
      Promise.resolve({
        buckets: [
          {
            start: "a",
            end: "b",
            closed: true,
            sampleSize: 1,
            metrics: range.from === from ? current : previous,
          },
        ],
      }),
  );
}

function scope(rangeKey: "30d" | "all" = "30d", game = "CRICKET_V2") {
  return Object.assign(marksSection(), {
    $data: { rangeKey, game, variation: 0 },
    $watch: () => {},
  });
}

describe("marksSection", () => {
  beforeEach(() => {
    loadGameSection.mockReset();
  });

  it("reads marks un-bucketed over the current and the preceding period", async () => {
    served(metrics(), metrics());
    await scope().load(NOW);
    expect(loadGameSection.mock.calls).toHaveLength(2);
    for (const call of loadGameSection.mock.calls) {
      expect(call[0]).toBe("CRICKET");
      expect(call[1]).toBe("marks");
    }
    const spans = loadGameSection.mock.calls.map((call) => call[2]);
    expect(spans).toContainEqual({
      ...heatmapWindow("30d", NOW),
      bucket: "none",
    });
    expect(spans).toContainEqual({
      ...precedingWindow("30d", NOW)!,
      bucket: "none",
    });
  });

  it("reads once for all time", async () => {
    served(metrics(), metrics());
    await scope("all").load(NOW);
    expect(loadGameSection.mock.calls).toHaveLength(1);
  });

  it("turns the current period into tiles and card rows", async () => {
    served(metrics(), metrics({ marks: 20 }));
    const s = scope();
    await s.load(NOW);
    expect(s.error).toBeNull();
    expect(s.tiles.map((t) => t.value)).toEqual(["2.50", "—", "20.0%", "—"]);
    expect(s.tiles[0]!.detail).toBe("+0.50 vs previous period");
    expect(s.card.objectives.map((row) => row.label)).toEqual(["20", "Bull"]);
    expect(s.card.rings.map((row) => row.cells[0])).toEqual([
      "50.0%",
      "25.0%",
      "25.0%",
    ]);
    expect(s.card.points).toEqual([]);
  });

  it("shows the points tile once the period has 1v1 darts", async () => {
    const duel = { games: 2, wins: 1, darts: 30, points: 200 };
    served(metrics({ duel }), metrics());
    const s = scope();
    await s.load(NOW);
    expect(s.card.points.map((t) => t.value)).toEqual(["20.0"]);
    expect(s.tiles[3]!.value).toBe("50.0%");
  });

  it("shows the message and empty rows when a read fails", async () => {
    loadGameSection.mockRejectedValue(new Error("range too wide"));
    const s = scope();
    await s.load(NOW);
    expect(s.error).toBe("range too wide");
    expect(s.card.objectives).toEqual([]);
  });
});
