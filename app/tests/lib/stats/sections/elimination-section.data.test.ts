import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  heatmapWindow,
  precedingWindow,
} from "@lib/stats/sections/score-trend-window";
import { emptyEliminationMetrics } from "@modules/stats/sections/elimination.module";
import type { EliminationMetrics } from "@modules/types";

const loadGameSection = vi.fn();
vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { eliminationSection } =
  await import("@lib/stats/sections/elimination-section.data");

const NOW = new Date("2026-11-20T12:00:00Z");

function metrics(edit: (m: EliminationMetrics) => void = () => {}) {
  const m = emptyEliminationMetrics();
  m.games = 40;
  m.finished = 40;
  m.wins = 20;
  m.darts = 400;
  edit(m);
  return m;
}

function served(current: EliminationMetrics, previous: EliminationMetrics) {
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

function scope(rangeKey: "30d" | "all" = "30d", game = "KILLER_V1") {
  return Object.assign(eliminationSection(), {
    $data: { rangeKey, game, variation: 0 },
    $watch: () => {},
  });
}

describe("eliminationSection", () => {
  beforeEach(() => {
    loadGameSection.mockReset();
  });

  it("reads elimination un-bucketed over the current and the preceding period", async () => {
    served(metrics(), metrics());
    await scope().load(NOW);
    expect(loadGameSection.mock.calls).toHaveLength(2);
    for (const call of loadGameSection.mock.calls) {
      expect(call[0]).toBe("KILLER");
      expect(call[1]).toBe("elimination");
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

  it("turns the page game's period into its tiles and rows", async () => {
    served(
      metrics((m) => {
        m.followTheLeader.byBed.TREBLE = { visits: 10, matched: 5 };
      }),
      metrics((m) => {
        m.wins = 10;
      }),
    );
    const s = scope("30d", "FOLLOW_THE_LEADER_V1");
    await s.load(NOW);
    expect(s.error).toBeNull();
    expect(s.tiles.map((t) => t.title)).toEqual([
      "Win rate",
      "Match rate",
      "Darts per match",
      "Lives lost per game",
    ]);
    expect(s.tiles[0]!.value).toBe("50.0%");
    expect(s.tiles[0]!.detail).toBe("+25.0 pp vs previous period");
    expect(s.card.beds[2]).toEqual({
      label: "Treble",
      count: 10,
      cells: ["50.0%"],
    });
    expect(s.card.results).toEqual([]);
  });

  it("shows the message and empty rows when a read fails", async () => {
    loadGameSection.mockRejectedValue(new Error("range too wide"));
    const s = scope("30d", "PRISONER_V1");
    await s.load(NOW);
    expect(s.error).toBe("range too wide");
    expect(s.card.results).toEqual([]);
    expect(s.tiles.map((t) => t.detail)).toEqual([
      "No finished games yet",
      "No darts yet",
      "No darts yet",
      "No finished games yet",
    ]);
  });
});
