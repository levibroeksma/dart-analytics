import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchGameVariations = vi.fn();

vi.mock("@client/api/statistics", () => ({
  fetchGameVariations: (...args: unknown[]) => fetchGameVariations(...args),
}));

const { gameVariations } =
  await import("@lib/stats/sections/game-variations.data");

function section(variation = 501) {
  const watchers: Record<string, (value?: number) => void> = {};
  const page = { game: "501_V1", variation };
  const set = vi.fn();
  const own = gameVariations();
  const s = Object.assign(own, {
    $data: page,
    $store: { statsVariation: { set } },
    $watch: (key: string, cb: (value: number) => void) => {
      watchers[key] = cb as (value?: number) => void;
    },
  });
  return { s, watchers, page, set };
}

function variations(...rows: [number, number][]) {
  return {
    variations: rows.map(([startingScore, sessions]) => ({
      startingScore,
      sessions,
    })),
  };
}

beforeEach(() => {
  fetchGameVariations.mockReset();
  fetchGameVariations.mockResolvedValue(
    variations([501, 12], [301, 4], [701, 1]),
  );
});

describe("gameVariations", () => {
  it("options come back ordered 501, 301, 701 with count labels", async () => {
    const { s } = section();
    await s.load();
    expect(fetchGameVariations).toHaveBeenCalledWith("501");
    expect(s.options).toEqual([
      { value: 501, label: "501 (12)" },
      { value: 301, label: "301 (4)" },
      { value: 701, label: "701 (1)" },
    ]);
    expect(s.loading).toBe(false);
  });

  it("keeps a remembered score that is listed", async () => {
    const { s, page } = section(301);
    await s.load();
    expect(page.variation).toBe(301);
  });

  it("falls back to 501 when the remembered score is absent", async () => {
    const { s, page } = section(1001);
    await s.load();
    expect(page.variation).toBe(501);
  });

  it("keeps the remembered variation when the options read fails", async () => {
    fetchGameVariations.mockRejectedValue(new Error("offline"));
    const { s, page } = section(301);
    await s.load();
    expect(s.options).toEqual([{ value: 301, label: "301" }]);
    expect(page.variation).toBe(301);
    expect(s.loading).toBe(false);
  });

  it("keeps the loaded options when a reload fails", async () => {
    const { s, page } = section(301);
    await s.load();
    fetchGameVariations.mockRejectedValue(new Error("offline"));
    await s.load();
    expect(s.options).toHaveLength(3);
    expect(page.variation).toBe(301);
  });

  it("a game change resets the selection to 501", async () => {
    const { s, watchers, page } = section(301);
    s.init();
    await vi.waitFor(() => expect(s.loading).toBe(false));
    page.game = "501_V2";
    watchers.game();
    expect(page.variation).toBe(501);
    await vi.waitFor(() =>
      expect(fetchGameVariations).toHaveBeenCalledTimes(2),
    );
  });

  it("remembers the picked variation in the store", () => {
    const { s, watchers, set } = section();
    s.init();
    watchers.variation(301);
    expect(set).toHaveBeenCalledWith(301);
  });
});
