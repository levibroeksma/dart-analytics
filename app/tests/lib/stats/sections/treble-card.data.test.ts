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
          "TREBLE:20|SOLE": {
            darts: 40,
            trebles: 8,
            singles: 16,
            neighbourLeft: 5,
            neighbourRight: 4,
            other: 7,
          },
        },
      },
    ],
  }),
}));

const { trebleCardSection } =
  await import("@lib/stats/sections/treble-card.data");
const { x01QualityStore } = await import("@stores/x01-quality.store");

describe("trebleCardSection", () => {
  it("exposes the card over the loaded rows", async () => {
    const s = Object.assign(trebleCardSection(), {
      $data: { rangeKey: "30d", game: "501_V1", variation: 501 },
      $watch: () => {},
      $store: { x01Quality: x01QualityStore() },
    });
    await s.load();
    expect(s.card.headline).toBe(0.2);
    expect(s.headline).toBe("20.0%");
    expect(s.caption).toBe("T20 treble rate, 40 darts");
    expect(s.table[0]).toEqual({
      label: "T20",
      count: 40,
      cells: ["20.0%", "40.0%", "12.5%", "10.0%", "17.5%"],
    });
    expect(s.table[1].cells).toEqual(["—", "—", "—", "—", "—"]);
  });
});
