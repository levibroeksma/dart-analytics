import { beforeEach, describe, expect, it, vi } from "vitest";
import { heatmapWindow } from "@lib/stats/sections/score-trend-window";

const loadGameSection = vi.fn();
vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { trackGamesCardSection } =
  await import("@lib/stats/sections/track-games-card.data");

const NOW = new Date("2026-11-17T12:00:00Z");

function series<M>(metrics: M) {
  return {
    buckets: [{ start: "a", end: "b", closed: true, sampleSize: 1, metrics }],
  };
}

function respond(bySection: Record<string, unknown>) {
  loadGameSection.mockImplementation(
    (_game: string, sectionId: string) => bySection[sectionId],
  );
}

function scope(game = "SHANGHAI_V1") {
  return Object.assign(trackGamesCardSection(), {
    $data: { rangeKey: "30d" as const, game, variation: 0 },
    $watch: () => {},
  });
}

const SAMPLE = {
  "target-accuracy": series({
    "NUMBER:14": { attempts: 41, hits: 32 },
    "NUMBER:15": { attempts: 30, hits: 20 },
    "NUMBER:16": { attempts: 24, hits: 14 },
    "NUMBER:17": { attempts: 43, hits: 18 },
  }),
  "miss-direction": series({}),
  "loose-darts": series({}),
};

describe("trackGamesCardSection", () => {
  beforeEach(() => loadGameSection.mockReset());

  it("loads the three sections for the page game over the period", async () => {
    respond(SAMPLE);
    await scope().load(NOW);
    const window = heatmapWindow("30d", NOW);
    expect(loadGameSection.mock.calls.map((call) => call[1])).toEqual([
      "target-accuracy",
      "miss-direction",
      "loose-darts",
    ]);
    for (const call of loadGameSection.mock.calls) {
      expect(call[0]).toBe("SHANGHAI");
      expect(call[2]).toMatchObject({ ...window, bucket: "none" });
    }
  });

  it("exposes tiles, table and footer", async () => {
    respond(SAMPLE);
    const s = scope();
    await s.load(NOW);
    expect(s.tiles[0]).toEqual({
      title: "Best target",
      value: "14",
      detail: "78.0% · 41 darts",
    });
    expect(s.table[0]).toMatchObject({ label: "14", count: 41 });
    expect(s.footer).toBe("138 darts · near miss within 20 mm");
  });

  it("orders the table by hit rate on request without touching the tiles", async () => {
    respond(SAMPLE);
    const s = scope();
    await s.load(NOW);
    const tiles = s.tiles;
    s.setSort("rate");
    expect(s.sort).toBe("rate");
    expect(s.table[0]!.label).toBe("17");
    expect(s.tiles).toEqual(tiles);
  });

  it("waits for darts and lists nothing with no darts", async () => {
    respond({
      "target-accuracy": series({}),
      "miss-direction": series({}),
      "loose-darts": series({}),
    });
    const s = scope();
    await s.load(NOW);
    expect(s.table).toEqual([]);
    expect(s.tiles.map((tile) => tile.detail)).toEqual([
      "Not enough darts yet",
      "Not enough darts yet",
      "Not enough darts yet",
    ]);
    expect(s.footer).toBe("0 darts · near miss within 20 mm");
  });

  it("reports a failing section as the error with no partial card", async () => {
    loadGameSection.mockImplementation((_game: string, sectionId: string) =>
      sectionId === "loose-darts"
        ? Promise.reject(new Error("range too wide"))
        : SAMPLE[sectionId as keyof typeof SAMPLE],
    );
    const s = scope();
    await s.load(NOW);
    expect(s.error).toBe("range too wide");
    expect(s.card.rows).toEqual([]);
    expect(s.loading).toBe(false);
  });

  it("drops a response that arrives after a newer load", async () => {
    let release: (value: unknown) => void = () => {};
    const slow = new Promise((resolve) => (release = resolve));
    loadGameSection.mockImplementationOnce(() => slow);
    loadGameSection.mockImplementation(
      (_game: string, sectionId: string) =>
        SAMPLE[sectionId as keyof typeof SAMPLE],
    );
    const s = scope();
    const first = s.load(NOW);
    respond({
      "target-accuracy": series({ "NUMBER:3": { attempts: 12, hits: 6 } }),
      "miss-direction": series({}),
      "loose-darts": series({}),
    });
    await s.load(NOW);
    release(series({ "NUMBER:20": { attempts: 99, hits: 99 } }));
    await first;
    expect(s.card.rows.map((row) => row.aim)).toEqual(["NUMBER:3"]);
  });

  it("finishes loading without a fetch for a game with no target rows", async () => {
    const s = scope("501_V1");
    await s.load(NOW);
    expect(loadGameSection).not.toHaveBeenCalled();
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
    expect(s.card.rows).toEqual([]);
  });
});
