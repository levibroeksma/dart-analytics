import { beforeEach, describe, expect, it, vi } from "vitest";

const loadGameSection = vi.fn();

vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { fetchBestLeg, fetchOverviewSections } =
  await import("@lib/stats/x01/overview-fetch");

const NOW = new Date("2026-10-01T10:00:00.000Z");

beforeEach(() => {
  loadGameSection.mockReset();
  loadGameSection.mockResolvedValue({ buckets: [] });
});

describe("fetchOverviewSections", () => {
  it("reads one bucketed scoring request and two unbucketed windows per server section", async () => {
    await fetchOverviewSections("30d", 501, NOW);
    const byId = (id: string) =>
      loadGameSection.mock.calls.filter(([, section]) => section === id);
    expect(byId("scoring-trend")).toHaveLength(1);
    for (const id of ["checkout-rate", "bust-rate", "leg-stats"])
      expect(byId(id).map(([, , r]) => r.bucket)).toEqual(["none", "none"]);
  });

  it("names every rejected read and leaves it empty", async () => {
    loadGameSection.mockImplementation((_game, id) =>
      id === "leg-stats" || id === "scoring-trend"
        ? Promise.reject(new Error("boom"))
        : Promise.resolve({ buckets: [] }),
    );
    const sections = await fetchOverviewSections("90d", 501, NOW);
    expect(sections.failed).toEqual(["averages", "darts per leg"]);
    expect(sections.legs).toEqual({ current: [], previous: [] });
  });

  it("has no previous period for All Time", async () => {
    const sections = await fetchOverviewSections("all", 501, NOW);
    expect(sections.hasPrevious).toBe(false);
    expect(
      loadGameSection.mock.calls.filter(([, id]) => id === "bust-rate"),
    ).toHaveLength(1);
  });
});

describe("fetchBestLeg", () => {
  it("returns the fewest-darts leg of the all-time read for the variation", async () => {
    loadGameSection.mockResolvedValue({
      buckets: [
        { metrics: { legs: {}, bestLeg: { darts: 15, sessionId: "b" } } },
      ],
    });
    const best = await fetchBestLeg(301, NOW);
    expect(best).toEqual({ darts: 15, sessionId: "b" });
    expect(loadGameSection.mock.calls[0][2]).toMatchObject({
      bucket: "none",
      variation: 301,
    });
  });

  it("is null with no finished leg", async () => {
    expect(await fetchBestLeg(501, NOW)).toBeNull();
  });
});
