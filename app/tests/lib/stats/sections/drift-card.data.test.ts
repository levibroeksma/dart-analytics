import { describe, expect, it, vi } from "vitest";

vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: vi.fn().mockResolvedValue({
    buckets: [
      {
        start: "a",
        end: "b",
        closed: true,
        sampleSize: 1,
        metrics: {
          "FINISH|DOUBLE:16|1|SOLE": {
            n: 40,
            sumDx: -160,
            sumDy: 80,
            sumDxDx: 1000,
            sumDyDy: 400,
            sumDxDy: 0,
          },
        },
      },
    ],
  }),
}));

const { driftCardSection } =
  await import("@lib/stats/sections/drift-card.data");
const { x01QualityStore } = await import("@stores/x01-quality.store");

describe("driftCardSection", () => {
  it("exposes headline, caption and overlay lines over the loaded rows", async () => {
    const s = Object.assign(driftCardSection(), {
      $data: { rangeKey: "30d", game: "501_V1", variation: 501 },
      $watch: () => {},
      $store: { x01Quality: x01QualityStore() },
    });
    await s.load();
    expect(s.headline).toBe("4 mm left, 2 mm low");
    expect(s.caption).toBe("1st dart drift, 40 darts");
    expect(s.table[0]).toEqual({
      label: "Dart 1",
      n: 40,
      cells: ["-4.0 mm", "2.0 mm", "3.9 mm"],
    });
    expect(s.table[1].cells).toEqual(["—", "—", "—"]);
    expect(s.table.at(-1)?.label).toBe("FINISH · dart 1");
  });

  it("lists the per-dart lines before the per-basis lines", async () => {
    const s = Object.assign(driftCardSection(), {
      $data: { rangeKey: "30d", game: "501_V1", variation: 501 },
      $watch: () => {},
      $store: { x01Quality: x01QualityStore() },
    });
    await s.load();
    expect(s.table.map((line) => line.label)).toEqual([
      "Dart 1",
      "Dart 2",
      "Dart 3",
      "FINISH · dart 1",
    ]);
  });
});
