import { describe, expect, it } from "vitest";
import { doublesTrainingCard } from "@lib/stats/doubles/doubles-training-card";
import type { SeriesBucket } from "@lib/types";
import type {
  LooseDartsMetrics,
  MissDirectionMetrics,
  TargetAccuracyMetrics,
} from "@modules/types";

function bucket<M>(metrics: M): SeriesBucket<M> {
  return { start: "a", end: "b", closed: true, sampleSize: 1, metrics };
}

const accuracy = (m: TargetAccuracyMetrics) => [bucket(m)];
const misses = (m: MissDirectionMetrics) => [bucket(m)];
const loose = (m: LooseDartsMetrics) => [bucket(m)];

describe("doublesTrainingCard", () => {
  it("joins hits, miss directions and loose darts per double", () => {
    const card = doublesTrainingCard({
      accuracy: accuracy({ "DOUBLE:16": { attempts: 40, hits: 20 } }),
      misses: misses({
        "DOUBLE:16": [
          { sector: 7, radial: "INSIDE", darts: 6 },
          { sector: 3, radial: "OUTSIDE", darts: 4 },
          { sector: 0, radial: "WITHIN", darts: 5 },
          { sector: 4, radial: "WITHIN", darts: 5 },
        ],
      }),
      loose: loose({ "DOUBLE:16": { onTarget: 20, nearMiss: 12, loose: 6 } }),
    });
    const row = {
      aim: "DOUBLE:16",
      label: "D16",
      darts: 40,
      hits: 20,
      rate: 0.5,
      left: 6,
      right: 4,
      high: 5,
      low: 5,
      inside: 6,
      within: 10,
      outside: 4,
      nearMiss: 12,
      loose: 6,
    };
    expect(card.rows).toEqual([row]);
    expect(card.favourite).toEqual(row);
    expect(card.darts).toBe(40);
  });

  it("hides the rate under ten darts and shows it at ten", () => {
    const card = doublesTrainingCard({
      accuracy: accuracy({
        "DOUBLE:1": { attempts: 9, hits: 9 },
        "DOUBLE:2": { attempts: 10, hits: 5 },
      }),
      misses: [],
      loose: [],
    });
    expect(card.rows.map((row) => row.rate)).toEqual([null, 0.5]);
  });

  it("picks the favourite among rows with thirty darts or more", () => {
    const card = doublesTrainingCard({
      accuracy: accuracy({
        "DOUBLE:1": { attempts: 29, hits: 29 },
        "DOUBLE:2": { attempts: 30, hits: 18 },
      }),
      misses: [],
      loose: [],
    });
    expect(card.favourite?.aim).toBe("DOUBLE:2");
  });

  it("breaks a rate tie by darts, then by the lower number", () => {
    const byDarts = doublesTrainingCard({
      accuracy: accuracy({
        "DOUBLE:3": { attempts: 30, hits: 15 },
        "DOUBLE:4": { attempts: 40, hits: 20 },
      }),
      misses: [],
      loose: [],
    });
    expect(byDarts.favourite?.aim).toBe("DOUBLE:4");
    const byNumber = doublesTrainingCard({
      accuracy: accuracy({
        "DOUBLE:6": { attempts: 30, hits: 15 },
        "DOUBLE:5": { attempts: 30, hits: 15 },
      }),
      misses: [],
      loose: [],
    });
    expect(byNumber.favourite?.aim).toBe("DOUBLE:5");
  });

  it("returns an empty card for no darts", () => {
    expect(
      doublesTrainingCard({ accuracy: [], misses: [], loose: [] }),
    ).toEqual({ favourite: null, darts: 0, rows: [] });
  });

  it("zeroes miss and loose fields for a double only in accuracy", () => {
    const [row] = doublesTrainingCard({
      accuracy: accuracy({ "DOUBLE:7": { attempts: 12, hits: 6 } }),
      misses: [],
      loose: [],
    }).rows;
    expect(row).toMatchObject({
      left: 0,
      right: 0,
      high: 0,
      low: 0,
      inside: 0,
      within: 0,
      outside: 0,
      nearMiss: 0,
      loose: 0,
    });
  });

  it("adds the same key across buckets", () => {
    const card = doublesTrainingCard({
      accuracy: [
        bucket({ "DOUBLE:8": { attempts: 10, hits: 4 } }),
        bucket({ "DOUBLE:8": { attempts: 20, hits: 6 } }),
      ],
      misses: [
        bucket({ "DOUBLE:8": [{ sector: 5, radial: "WITHIN", darts: 2 }] }),
        bucket({ "DOUBLE:8": [{ sector: 6, radial: "WITHIN", darts: 3 }] }),
      ],
      loose: [
        bucket({ "DOUBLE:8": { onTarget: 4, nearMiss: 1, loose: 2 } }),
        bucket({ "DOUBLE:8": { onTarget: 6, nearMiss: 3, loose: 4 } }),
      ],
    });
    expect(card.rows[0]).toMatchObject({
      darts: 30,
      hits: 10,
      left: 5,
      within: 5,
      nearMiss: 4,
      loose: 6,
    });
  });

  it("keeps a rate tie in number order whatever the key order", () => {
    const card = doublesTrainingCard({
      accuracy: accuracy({
        "DOUBLE:12": { attempts: 30, hits: 15 },
        "DOUBLE:4": { attempts: 30, hits: 15 },
        "DOUBLE:9": { attempts: 30, hits: 15 },
      }),
      misses: [],
      loose: [],
    });
    expect(card.rows.map((row) => row.aim)).toEqual([
      "DOUBLE:4",
      "DOUBLE:9",
      "DOUBLE:12",
    ]);
    expect(card.favourite?.aim).toBe("DOUBLE:4");
  });

  it("ignores other keys and sorts the bull last", () => {
    const card = doublesTrainingCard({
      accuracy: accuracy({
        "INNER_BULL:25": { attempts: 12, hits: 3 },
        "DOUBLE:20": { attempts: 12, hits: 3 },
        "DOUBLE:2": { attempts: 12, hits: 3 },
        "TREBLE:20": { attempts: 99, hits: 9 },
      }),
      misses: [],
      loose: [],
    });
    expect(card.rows.map((row) => row.label)).toEqual(["D2", "D20", "BULL"]);
    expect(card.darts).toBe(36);
  });
});
