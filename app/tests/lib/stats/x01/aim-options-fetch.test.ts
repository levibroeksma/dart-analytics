import { beforeEach, describe, expect, it, vi } from "vitest";

const loadGameSection = vi.fn();

vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { fetchAimOptions } = await import("@lib/stats/x01/aim-options-fetch");

const NOW = new Date("2026-10-01T10:00:00.000Z");

beforeEach(() => {
  loadGameSection.mockReset();
  loadGameSection.mockResolvedValue({
    buckets: [
      {
        start: "a",
        end: "b",
        closed: true,
        sampleSize: 1,
        metrics: { "SETUP|TREBLE:20|1|SOLE": { n: 1 } },
      },
    ],
  });
});

describe("fetchAimOptions", () => {
  it("reads aim-drift un-bucketed for the 501 variation and builds options", async () => {
    const options = await fetchAimOptions("30d", 301, NOW);
    const [game, id, range] = loadGameSection.mock.calls[0];
    expect([game, id, range.bucket, range.variation]).toEqual([
      "501",
      "aim-drift",
      "none",
      301,
    ]);
    expect(options.map((o) => o.label)).toEqual(["All aims", "T20"]);
  });

  it("sends the default variation unchanged", async () => {
    await fetchAimOptions("30d", 501, NOW);
    expect(loadGameSection.mock.calls[0][2].variation).toBe(501);
  });
});
