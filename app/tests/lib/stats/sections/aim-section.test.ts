import { beforeEach, describe, expect, it, vi } from "vitest";

const loadGameSection = vi.fn();

vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { aimSection } = await import("@lib/stats/sections/aim-section");
const { x01QualityStore } = await import("@stores/x01-quality.store");

const NOW = new Date("2026-10-01T10:00:00.000Z");

const bucket = (metrics: Record<string, Record<string, number>>) => ({
  start: "a",
  end: "b",
  closed: true,
  sampleSize: 1,
  metrics,
});

function section(id: "aim-drift" | "large-target-accuracy" = "aim-drift") {
  const quality = x01QualityStore();
  const s = Object.assign(aimSection(id), {
    $data: { rangeKey: "30d", game: "501_V1", variation: 501 },
    $watch: () => {},
    $store: { x01Quality: quality },
  });
  return { s, quality };
}

beforeEach(() => {
  loadGameSection.mockReset();
  loadGameSection.mockResolvedValue({ buckets: [] });
});

describe("aimSection", () => {
  it("rows merges the buckets", async () => {
    loadGameSection.mockResolvedValue({
      buckets: [
        bucket({ "A|1": { darts: 2 } }),
        bucket({ "A|1": { darts: 3 } }),
      ],
    });
    const { s } = section();
    await s.load(NOW);
    expect(s.rows).toEqual({ "A|1": { darts: 5 } });
  });

  it("reports the series skipped count to the quality store", async () => {
    loadGameSection.mockResolvedValue({ buckets: [], skippedSessions: 4 });
    const { s, quality } = section();
    await s.load(NOW);
    expect(quality.skipped).toBe(4);
  });

  it("an errored load reports zero", async () => {
    const { s, quality } = section();
    quality.report("aim-drift", 9);
    loadGameSection.mockRejectedValue(new Error("boom"));
    await s.load(NOW);
    expect(s.error).toBe("boom");
    expect(quality.skipped).toBe(0);
  });

  it("a superseded load does not report", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    loadGameSection
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveFirst = resolve)),
      )
      .mockResolvedValueOnce({ buckets: [], skippedSessions: 1 });
    const { s, quality } = section();
    const first = s.load(NOW);
    await s.load(NOW);
    resolveFirst({ buckets: [], skippedSessions: 99 });
    await first;
    expect(quality.skipped).toBe(1);
  });
});
