import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  heatmapWindow,
  precedingWindow,
} from "@lib/stats/sections/score-trend-window";

const loadGameSection = vi.fn();
vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { checkoutComparisonSection } =
  await import("@lib/stats/sections/checkout-comparison.data");

const NOW = new Date("2026-11-17T12:00:00Z");

function series<M>(metrics: M) {
  return {
    buckets: [{ start: "a", end: "b", closed: true, sampleSize: 1, metrics }],
  };
}

function ladder(attempts: number, successes: number, maxTarget: number) {
  return {
    targets: { "41": { attempts, successes } },
    maxTarget,
    afterMiss: 0,
    recovered: 0,
  };
}

function scope(rangeKey: "30d" | "all" = "30d", game = "TUOD_V1") {
  return Object.assign(checkoutComparisonSection(), {
    $data: { rangeKey, game, variation: 0 },
    $watch: () => {},
  });
}

function ladderBy(from: string, current: unknown, previous: unknown) {
  loadGameSection.mockImplementation(
    (_game: string, sectionId: string, range: { from: string }) =>
      Promise.resolve(
        series(
          sectionId === "ladder-progress"
            ? range.from === from
              ? current
              : previous
            : {},
        ),
      ),
  );
}

describe("checkoutComparisonSection", () => {
  beforeEach(() => loadGameSection.mockReset());

  it("reads ladder and bust rate over the current and the preceding period", async () => {
    ladderBy(
      heatmapWindow("30d", NOW).from,
      ladder(0, 0, 41),
      ladder(0, 0, 41),
    );
    await scope().load(NOW);
    const spans = loadGameSection.mock.calls.map((call) => call[2]);
    expect(loadGameSection.mock.calls).toHaveLength(4);
    expect(loadGameSection.mock.calls.every((call) => call[0] === "TUOD")).toBe(
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
    ladderBy(
      heatmapWindow("30d", NOW).from,
      ladder(40, 20, 61),
      ladder(50, 20, 51),
    );
    const s = scope();
    await s.load(NOW);
    expect(s.error).toBeNull();
    expect(s.tiles[0]).toEqual({
      title: "Finish rate",
      value: "50.0%",
      detail: "+10.0 pp vs previous period",
    });
    expect(s.tiles[1]).toEqual({
      title: "Highest target",
      value: "61",
      detail: "+10 vs previous period",
    });
  });

  it("reads the current period alone for all time", async () => {
    ladderBy(heatmapWindow("all", NOW).from, ladder(40, 20, 61), {});
    const s = scope("all");
    await s.load(NOW);
    expect(loadGameSection.mock.calls).toHaveLength(2);
    expect(s.tiles.map((tile) => tile.detail)[0]).toBe("No earlier period");
  });

  it("shows the message and empty tiles when a read fails", async () => {
    loadGameSection.mockImplementation((_game: string, sectionId: string) =>
      sectionId === "bust-rate"
        ? Promise.reject(new Error("range too wide"))
        : Promise.resolve(series(ladder(0, 0, 41))),
    );
    const s = scope();
    await s.load(NOW);
    expect(s.error).toBe("range too wide");
    expect(s.tiles.map((tile) => tile.value)).toEqual(["—", "—", "—", "—"]);
  });

  it("makes no read for an unknown ruleset", async () => {
    const s = scope("30d", "NOPE");
    await s.load(NOW);
    expect(loadGameSection).not.toHaveBeenCalled();
    expect(s.error).toBeNull();
  });

  it("starts loading with four titled tiles", () => {
    const s = scope();
    expect(s.loading).toBe(true);
    expect(s.tiles.map((tile) => tile.title)).toEqual([
      "Finish rate",
      "Highest target",
      "Recovery rate",
      "Bust rate",
    ]);
  });

  it("watches the page filters and loads on init", async () => {
    loadGameSection.mockResolvedValue(series({}));
    const watched: string[] = [];
    const s = Object.assign(checkoutComparisonSection(), {
      $data: { rangeKey: "30d" as const, game: "TUOD_V1", variation: 0 },
      $watch: (key: string) => void watched.push(key),
    });
    s.init();
    expect(watched).toEqual(["rangeKey", "game", "variation"]);
    await vi.waitFor(() => expect(s.loading).toBe(false));
  });
});
