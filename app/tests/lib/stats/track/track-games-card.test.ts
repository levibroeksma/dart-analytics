import { describe, expect, it } from "vitest";
import { trackGamesCard } from "@lib/stats/track/track-games-card";
import type { SeriesBucket } from "@lib/types";
import type { TargetAccuracyMetrics } from "@modules/types";

const KEYS = new Set(["NUMBER:14", "NUMBER:15", "NUMBER:16", "NUMBER:17"]);

function card(accuracy: TargetAccuracyMetrics, keys = KEYS) {
  const bucket: SeriesBucket<TargetAccuracyMetrics> = {
    start: "a",
    end: "b",
    closed: true,
    sampleSize: 1,
    metrics: accuracy,
  };
  return trackGamesCard({ accuracy: [bucket], misses: [], loose: [] }, keys);
}

const SAMPLE: TargetAccuracyMetrics = {
  "NUMBER:14": { attempts: 41, hits: 32 },
  "NUMBER:15": { attempts: 30, hits: 20 },
  "NUMBER:16": { attempts: 24, hits: 14 },
  "NUMBER:17": { attempts: 43, hits: 18 },
};

describe("trackGamesCard", () => {
  it("ranks best, most failed and weakest three among rows of thirty darts or more", () => {
    const result = card(SAMPLE);
    expect(result.best?.aim).toBe("NUMBER:14");
    expect(result.worst?.aim).toBe("NUMBER:17");
    expect(result.weakest.map((row) => row.aim)).toEqual([
      "NUMBER:17",
      "NUMBER:15",
      "NUMBER:14",
    ]);
    expect(result.darts).toBe(138);
    expect(result.rows.map((row) => row.aim)).toEqual([
      "NUMBER:14",
      "NUMBER:15",
      "NUMBER:16",
      "NUMBER:17",
    ]);
  });

  it("makes one qualifying row best and most failed at once", () => {
    const result = card({ "NUMBER:14": { attempts: 30, hits: 15 } });
    expect(result.best?.aim).toBe("NUMBER:14");
    expect(result.worst?.aim).toBe("NUMBER:14");
    expect(result.weakest).toHaveLength(1);
  });

  it("has no tiles while every row is under thirty darts", () => {
    const result = card({
      "NUMBER:14": { attempts: 29, hits: 29 },
      "NUMBER:15": { attempts: 29, hits: 0 },
    });
    expect(result.best).toBeNull();
    expect(result.worst).toBeNull();
    expect(result.weakest).toEqual([]);
    expect(result.rows).toHaveLength(2);
  });

  it("returns an empty card for no darts", () => {
    expect(card({})).toEqual({
      best: null,
      worst: null,
      weakest: [],
      darts: 0,
      rows: [],
    });
  });

  it("breaks a rate tie by darts, then by the lower number", () => {
    const byDarts = card({
      "NUMBER:15": { attempts: 30, hits: 15 },
      "NUMBER:16": { attempts: 40, hits: 20 },
    });
    expect(byDarts.best?.aim).toBe("NUMBER:16");
    expect(byDarts.worst?.aim).toBe("NUMBER:16");
    const byNumber = card({
      "NUMBER:16": { attempts: 30, hits: 15 },
      "NUMBER:15": { attempts: 30, hits: 15 },
    });
    expect(byNumber.best?.aim).toBe("NUMBER:15");
    expect(byNumber.worst?.aim).toBe("NUMBER:15");
  });

  it("ignores keys outside the game's row set", () => {
    const result = card({
      ...SAMPLE,
      "NUMBER:2": { attempts: 99, hits: 99 },
      "DOUBLE:5": { attempts: 99, hits: 0 },
    });
    expect(result.darts).toBe(138);
    expect(result.rows).toHaveLength(4);
  });
});
