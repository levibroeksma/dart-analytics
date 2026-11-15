import { describe, expect, it, vi } from "vitest";
import { loadedAimCard, oneBucket } from "../../../support/aim-card-scope";

vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: vi.fn().mockResolvedValue(
    oneBucket({
      "ROUTE|TREBLE|SOLE": { attempts: 30, hits: 15 },
      VISITS: { visits: 20, goodLeaves: 15 },
    }),
  ),
}));

const { setupCardSection } =
  await import("@lib/stats/sections/setup-card.data");

describe("setupCardSection", () => {
  it("exposes headline, caption and overlay lines", async () => {
    const s = await loadedAimCard(setupCardSection);
    expect(s.headline).toBe("50.0%");
    expect(s.caption).toBe("Good leave 75.0%, 20 visits");
    expect(s.table[0]).toEqual({
      label: "ROUTE · TREBLE",
      count: 30,
      cells: ["50.0%", "15/30"],
    });
  });
});
