import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  heatmapWindow,
  precedingWindow,
} from "@lib/stats/sections/score-trend-window";

const loadGameSection = vi.fn();
vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { aceComparisonSection } =
  await import("@lib/stats/sections/ace-comparison.data");

const NOW = new Date("2026-11-17T12:00:00Z");

function series<M>(metrics: M) {
  return {
    buckets: [{ start: "a", end: "b", closed: true, sampleSize: 1, metrics }],
  };
}

function scope(rangeKey: "30d" | "all" = "30d", game = "ACE_V1") {
  return Object.assign(aceComparisonSection(), {
    $data: { rangeKey, game, variation: 0 },
    $watch: () => {},
  });
}

function accuracyBy(from: string, current: unknown, previous: unknown) {
  loadGameSection.mockImplementation(
    (_game: string, sectionId: string, range: { from: string }) =>
      Promise.resolve(
        series(
          sectionId === "target-accuracy"
            ? range.from === from
              ? current
              : previous
            : {},
        ),
      ),
  );
}

describe("aceComparisonSection", () => {
  beforeEach(() => loadGameSection.mockReset());

  it("reads the three sections over the current and the preceding period", async () => {
    accuracyBy(heatmapWindow("30d", NOW).from, {}, {});
    await scope().load(NOW);
    const spans = loadGameSection.mock.calls.map((call) => call[2]);
    expect(loadGameSection.mock.calls).toHaveLength(6);
    expect(loadGameSection.mock.calls.every((call) => call[0] === "ACE")).toBe(
      true,
    );
    expect(spans).toContainEqual({
      ...heatmapWindow("30d", NOW),
      bucket: "none",
    });
    expect(spans).toContainEqual({
      ...precedingWindow("30d", NOW)!,
      bucket: "none",
    });
  });

  it("turns both periods into the comparison tiles", async () => {
    accuracyBy(
      heatmapWindow("30d", NOW).from,
      { "NUMBER:7": { attempts: 40, hits: 16 } },
      { "NUMBER:7": { attempts: 50, hits: 15 } },
    );
    const s = scope();
    await s.load(NOW);
    expect(s.error).toBeNull();
    expect(s.tiles[0]).toEqual({
      title: "Target hit rate",
      value: "40.0%",
      detail: "+10.0 pp vs previous period",
    });
  });

  it("reads the current period alone for all time", async () => {
    accuracyBy(
      heatmapWindow("all", NOW).from,
      { "NUMBER:7": { attempts: 40, hits: 16 } },
      {},
    );
    const s = scope("all");
    await s.load(NOW);
    expect(loadGameSection.mock.calls).toHaveLength(3);
    expect(s.tiles[0]!.detail).toBe("No comparison yet");
  });

  it("shows the message and empty tiles when a read fails", async () => {
    loadGameSection.mockImplementation((_game: string, sectionId: string) =>
      sectionId === "loose-darts"
        ? Promise.reject(new Error("range too wide"))
        : Promise.resolve(series({})),
    );
    const s = scope();
    await s.load(NOW);
    expect(s.error).toBe("range too wide");
    expect(s.tiles.map((tile) => tile.value)).toEqual(["—", "—", "—"]);
  });

  it("shows placeholder tiles while loading", () => {
    const s = scope();
    expect(s.loading).toBe(true);
    expect(s.tiles.map((tile) => tile.title)).toEqual([
      "Target hit rate",
      "Drift",
      "Near miss share",
    ]);
  });

  it("drops a stale response when a newer load started", async () => {
    let release: (value: unknown) => void = () => {};
    loadGameSection.mockImplementationOnce(
      () => new Promise((resolve) => (release = resolve)),
    );
    loadGameSection.mockImplementation(() => Promise.resolve(series({})));
    const s = scope();
    const first = s.load(NOW);
    accuracyBy(
      heatmapWindow("30d", NOW).from,
      { "NUMBER:7": { attempts: 40, hits: 16 } },
      {},
    );
    await s.load(NOW);
    release(series({ "NUMBER:7": { attempts: 40, hits: 40 } }));
    await first;
    expect(s.tiles[0]!.value).toBe("40.0%");
  });
});
