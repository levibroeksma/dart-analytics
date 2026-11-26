import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  heatmapWindow,
  precedingWindow,
} from "@lib/stats/sections/score-trend-window";
import { emptyFivesMetrics } from "@modules/stats/sections/fives.module";
import type { FivesMetrics } from "@modules/types";

const loadGameSection = vi.fn();
vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { fivesSection } = await import("@lib/stats/sections/fives-section.data");

const NOW = new Date("2026-11-20T12:00:00Z");

function metrics(edit: Partial<FivesMetrics> = {}): FivesMetrics {
  return {
    ...emptyFivesMetrics(),
    games: 40,
    finished: 40,
    wins: 20,
    visits: 100,
    scoringVisits: 40,
    voids: 10,
    busts: 5,
    points: 120,
    winVisits: 200,
    ...edit,
  };
}

function served(current: FivesMetrics, previous: FivesMetrics) {
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

function scope(rangeKey: "30d" | "all" = "30d") {
  return Object.assign(fivesSection(), {
    $data: { rangeKey, game: "FIVES_V1", variation: 0 },
    $watch: () => {},
  });
}

describe("fivesSection", () => {
  beforeEach(() => {
    loadGameSection.mockReset();
  });

  it("reads fives un-bucketed over the current and the preceding period", async () => {
    served(metrics(), metrics());
    await scope().load(NOW);
    expect(loadGameSection.mock.calls).toHaveLength(2);
    for (const call of loadGameSection.mock.calls) {
      expect(call[0]).toBe("FIVES");
      expect(call[1]).toBe("fives");
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

  it("turns the period into its tiles and outcome rows", async () => {
    served(metrics(), metrics({ wins: 10 }));
    const s = scope();
    await s.load(NOW);
    expect(s.error).toBeNull();
    expect(s.tiles.map((t) => t.title)).toEqual([
      "Win rate",
      "Scoring visit rate",
      "Points per visit",
      "Visits per win",
    ]);
    expect(s.tiles[0]!.value).toBe("50.0%");
    expect(s.tiles[0]!.detail).toBe("+25.0 pp vs previous period");
    expect(s.tiles[2]!.value).toBe("1.2");
    expect(s.tiles[3]!.value).toBe("10.0");
    expect(s.card.outcomes.map((row) => row.count)).toEqual([40, 45, 10, 5]);
  });

  it("shows the message and empty tiles when a read fails", async () => {
    loadGameSection.mockRejectedValue(new Error("range too wide"));
    const s = scope();
    await s.load(NOW);
    expect(s.error).toBe("range too wide");
    expect(s.card.outcomes).toEqual([]);
    expect(s.tiles.map((t) => t.detail)).toEqual([
      "No finished games yet",
      "No visits yet",
      "No visits yet",
      "No wins",
    ]);
  });
});
