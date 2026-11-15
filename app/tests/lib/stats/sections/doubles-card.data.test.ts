import { describe, expect, it, vi } from "vitest";
import { loadedAimCard, oneBucket } from "../../../support/aim-card-scope";

vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: vi.fn().mockResolvedValue(
    oneBucket({
      "DOUBLE:16|SOLE|HIT": { darts: 20 },
      "DOUBLE:16|SOLE|MISS|INSIDE|0": { darts: 20 },
    }),
  ),
}));

const { doublesCardSection } =
  await import("@lib/stats/sections/doubles-card.data");

describe("doublesCardSection", () => {
  it("exposes headline, caption and overlay lines", async () => {
    const s = await loadedAimCard(doublesCardSection);
    expect(s.headline).toBe("50.0%");
    expect(s.caption).toBe("Doubles, 40 darts");
    expect(s.table[0]).toEqual({
      label: "D16",
      count: 40,
      cells: ["50.0%", "20/0/0", "20 0 0 0 0 0 0 0"],
    });
  });
});
