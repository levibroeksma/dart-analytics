import { beforeEach, describe, expect, it, vi } from "vitest";

const readSection = vi.fn();
const fetchGameSection = vi.fn();

vi.mock("@client/stats-cache/cache", () => ({
  readSection: (...args: unknown[]) => readSection(...args),
}));
vi.mock("@client/api/statistics", () => ({
  fetchGameSection: (...args: unknown[]) => fetchGameSection(...args),
}));

const { loadGameSection, CACHE_PLAYER_ID } =
  await import("@lib/stats/load-game-section");
const { SECTIONS } = await import("@lib/stats/section-registry");

const range = {
  from: "2026-09-01T00:00:00.000Z",
  to: "2026-10-01T00:01:00.000Z",
  bucket: "day" as const,
  tz: "Europe/Amsterdam",
};

beforeEach(() => {
  readSection.mockReset();
  fetchGameSection.mockReset();
  readSection.mockResolvedValue({ buckets: [] });
});

describe("loadGameSection", () => {
  it("reads through the cache under the game scope, the section meta and the VISUAL_BOARD all-context query", async () => {
    await loadGameSection("SCORE_TRAINING", "scoring-trend", range);
    expect(readSection).toHaveBeenCalledWith(
      CACHE_PLAYER_ID,
      { key: expect.any(String), gameTypeKey: "SCORE_TRAINING" },
      SECTIONS["scoring-trend"],
      { ...range, context: "all", inputMode: "VISUAL_BOARD" },
      expect.any(Function),
    );
  });

  it("fetches the section with the range merged over the cache's span", async () => {
    await loadGameSection("SCORE_TRAINING", "scoring-trend", range);
    const fetcher = readSection.mock.calls[0][4] as (span: unknown) => unknown;
    const span = { from: "2026-09-15T00:00:00.000Z", to: range.to };
    fetcher(span);
    expect(fetchGameSection).toHaveBeenCalledWith(
      "SCORE_TRAINING",
      "scoring-trend",
      { ...range, ...span },
    );
  });

  it("returns the cache's series", async () => {
    readSection.mockResolvedValue({ buckets: [{ start: "x" }] });
    await expect(
      loadGameSection("SCORE_TRAINING", "scoring-trend", range),
    ).resolves.toEqual({ buckets: [{ start: "x" }] });
  });
});
