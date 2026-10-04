import { beforeEach, describe, expect, it, vi } from "vitest";

const loadGameSection = vi.fn();

vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { personalBestFinishSection } =
  await import("@lib/stats/sections/personal-best-finish.data");

const NOW = new Date("2026-10-01T10:00:00.000Z");

beforeEach(() => {
  loadGameSection.mockReset();
});

describe("personalBestFinishSection", () => {
  it("requests all-time ladder-progress for 121, un-bucketed", async () => {
    loadGameSection.mockResolvedValue({
      buckets: [
        {
          start: "a",
          end: "b",
          closed: true,
          sampleSize: 1,
          metrics: { targets: {}, maxTarget: 131, afterMiss: 0, recovered: 0 },
        },
      ],
    });
    const s = personalBestFinishSection();
    await s.load(NOW);
    expect(loadGameSection).toHaveBeenCalledWith(
      "ONE_TWENTY_ONE",
      "ladder-progress",
      expect.objectContaining({ bucket: "none" }),
    );
    expect(s.finish).toBe(130);
    expect(s.loading).toBe(false);
  });

  it("falls back to null when the request fails", async () => {
    loadGameSection.mockRejectedValue(new Error("boom"));
    const s = personalBestFinishSection();
    await s.load(NOW);
    expect(s.finish).toBeNull();
    expect(s.loading).toBe(false);
  });
});
