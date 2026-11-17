import { describe, expect, it } from "vitest";
import { tallyDoublesTraining } from "@lib/stats/doubles/doubles-training-rows";
import type { SeriesBucket } from "@lib/types";

function bucket<M>(metrics: M): SeriesBucket<M> {
  return { start: "a", end: "b", closed: true, sampleSize: 1, metrics };
}

describe("tallyDoublesTraining", () => {
  it("maps each of the eight sectors to its direction", () => {
    const rows = tallyDoublesTraining({
      accuracy: [bucket({ "DOUBLE:20": { attempts: 8, hits: 0 } })],
      misses: [
        bucket({
          "DOUBLE:20": [0, 1, 2, 3, 4, 5, 6, 7].map((sector) => ({
            sector,
            radial: "WITHIN" as const,
            darts: 1,
          })),
        }),
      ],
      loose: [],
    });
    expect(rows[0]).toMatchObject({
      high: 1,
      right: 3,
      low: 1,
      left: 3,
      within: 8,
      inside: 0,
      outside: 0,
    });
  });

  it("keeps doubles and the double bull, drops other targets and unknown rows", () => {
    const rows = tallyDoublesTraining({
      accuracy: [
        bucket({
          "DOUBLE:21": { attempts: 5, hits: 1 },
          "DOUBLE:0": { attempts: 5, hits: 1 },
          "TREBLE:20": { attempts: 5, hits: 1 },
          "OUTER_BULL:25": { attempts: 5, hits: 1 },
          "INNER_BULL:25": { attempts: 5, hits: 1 },
          "DOUBLE:1": { attempts: 5, hits: 1 },
        }),
      ],
      misses: [
        bucket({ "DOUBLE:9": [{ sector: 0, radial: "INSIDE", darts: 3 }] }),
      ],
      loose: [bucket({ "DOUBLE:9": { onTarget: 0, nearMiss: 2, loose: 1 } })],
    });
    expect(rows.map((row) => row.aim)).toEqual(["DOUBLE:1", "INNER_BULL:25"]);
  });

  it("keeps only the rows of a given key set", () => {
    const rows = tallyDoublesTraining(
      {
        accuracy: [
          bucket({
            "NUMBER:3": { attempts: 12, hits: 6 },
            "NUMBER:4": { attempts: 12, hits: 6 },
            "DOUBLE:3": { attempts: 12, hits: 6 },
            "BULL:25": { attempts: 12, hits: 6 },
          }),
        ],
        misses: [],
        loose: [],
      },
      new Set(["NUMBER:3", "BULL:25"]),
    );
    expect(rows.map((row) => row.label)).toEqual(["3", "Bull"]);
  });

  it("orders rows of one number by zone, whatever the key order", () => {
    const keys = new Set(["NUMBER:5", "OUTER_SINGLE:5"]);
    const input = (first: string, second: string) => ({
      accuracy: [
        bucket({
          [first]: { attempts: 12, hits: 6 },
          [second]: { attempts: 12, hits: 6 },
        }),
      ],
      misses: [],
      loose: [],
    });
    const forward = tallyDoublesTraining(
      input("NUMBER:5", "OUTER_SINGLE:5"),
      keys,
    );
    const reverse = tallyDoublesTraining(
      input("OUTER_SINGLE:5", "NUMBER:5"),
      keys,
    );
    expect(forward.map((row) => row.aim)).toEqual([
      "NUMBER:5",
      "OUTER_SINGLE:5",
    ]);
    expect(reverse.map((row) => row.aim)).toEqual([
      "NUMBER:5",
      "OUTER_SINGLE:5",
    ]);
  });
});
