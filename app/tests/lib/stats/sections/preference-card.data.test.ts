import { describe, expect, it, vi } from "vitest";
import { loadedAimCard, oneBucket } from "../../../support/aim-card-scope";

vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: vi.fn().mockResolvedValue(
    oneBucket({
      "DOUBLE:16|STATE": { left: 40, splitAway: 12 },
      "DOUBLE:16|SOLE": { attempts: 10, hits: 3 },
    }),
  ),
}));

const { preferenceCardSection } =
  await import("@lib/stats/sections/preference-card.data");

describe("preferenceCardSection", () => {
  it("exposes headline, caption and overlay lines", async () => {
    const s = await loadedAimCard(preferenceCardSection);
    expect(s.headline).toBe("D16 left most · split away 30%");
    expect(s.caption).toBe("Doubles left, 40 visits");
    expect(s.table[0]).toEqual({
      label: "D16",
      count: 40,
      cells: ["12", "30.0%", "3/10"],
    });
  });
});
