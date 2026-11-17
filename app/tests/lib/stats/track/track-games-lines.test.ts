import { describe, expect, it } from "vitest";
import { trackGamesCard } from "@lib/stats/track/track-games-card";
import { trackTable, trackTiles } from "@lib/stats/track/track-games-lines";
import type { SeriesBucket } from "@lib/types";
import type { TargetAccuracyMetrics } from "@modules/types";

const KEYS = new Set(["NUMBER:14", "NUMBER:15", "NUMBER:16", "NUMBER:17"]);

function card(accuracy: TargetAccuracyMetrics) {
  const bucket: SeriesBucket<TargetAccuracyMetrics> = {
    start: "a",
    end: "b",
    closed: true,
    sampleSize: 1,
    metrics: accuracy,
  };
  return trackGamesCard({ accuracy: [bucket], misses: [], loose: [] }, KEYS);
}

const SAMPLE = card({
  "NUMBER:14": { attempts: 41, hits: 32 },
  "NUMBER:15": { attempts: 30, hits: 20 },
  "NUMBER:16": { attempts: 24, hits: 14 },
  "NUMBER:17": { attempts: 43, hits: 18 },
});

describe("trackTiles", () => {
  it("states best, most failed and weakest three", () => {
    expect(trackTiles(SAMPLE)).toEqual([
      { title: "Best target", value: "14", detail: "78.0% · 41 darts" },
      { title: "Most failed", value: "17", detail: "41.9% · 43 darts" },
      {
        title: "Weakest three",
        value: "17 · 15 · 14",
        detail: "41.9% · 66.7% · 78.0%",
      },
    ]);
  });

  it("waits for darts while no row has thirty", () => {
    const tiles = trackTiles(card({ "NUMBER:14": { attempts: 12, hits: 6 } }));
    expect(tiles.map((tile) => [tile.value, tile.detail])).toEqual([
      ["—", "Not enough darts yet"],
      ["—", "Not enough darts yet"],
      ["—", "Not enough darts yet"],
    ]);
  });
});

describe("trackTable", () => {
  it("lists rows in target order", () => {
    const table = trackTable(SAMPLE, "target");
    expect(table.map((row) => row.label)).toEqual(["14", "15", "16", "17"]);
    expect(table[0]).toMatchObject({ count: 41 });
    expect(table[0]!.cells[0]).toBe("78.0%");
  });

  it("lists the lowest hit rate first, thin rows last, ties by number", () => {
    const table = trackTable(
      card({
        "NUMBER:14": { attempts: 20, hits: 10 },
        "NUMBER:15": { attempts: 5, hits: 0 },
        "NUMBER:16": { attempts: 20, hits: 10 },
        "NUMBER:17": { attempts: 20, hits: 4 },
      }),
      "rate",
    );
    expect(table.map((row) => row.label)).toEqual(["17", "14", "16", "15"]);
  });
});
