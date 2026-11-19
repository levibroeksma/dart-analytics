import { describe, expect, it, vi } from "vitest";
import {
  comparisonSection,
  periodComparison,
} from "@lib/stats/sections/comparison-section";

const NOW = new Date("2026-11-17T12:00:00Z");

function scope(fetchCard: Parameters<typeof comparisonSection<number>>[0]) {
  return Object.assign(
    comparisonSection(fetchCard, 0, (n) => [
      { title: "n", value: String(n), detail: "" },
    ]),
    {
      $data: { rangeKey: "30d" as const, game: "G", variation: 0 },
      $watch: vi.fn(),
    },
  );
}

describe("comparisonSection", () => {
  it("starts loading with the empty card's tiles", () => {
    const s = scope(() => Promise.resolve({ card: 5, error: null }));
    expect(s.loading).toBe(true);
    expect(s.tiles[0]!.value).toBe("0");
  });

  it("loads the card for the page game and period", async () => {
    const fetchCard = vi.fn().mockResolvedValue({ card: 7, error: null });
    const s = scope(fetchCard);
    await s.load(NOW);
    expect(fetchCard).toHaveBeenCalledWith("G", "30d", NOW);
    expect(s.tiles[0]!.value).toBe("7");
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it("keeps the message from a failed read", async () => {
    const s = scope(() => Promise.resolve({ card: 0, error: "boom" }));
    await s.load(NOW);
    expect(s.error).toBe("boom");
  });
});

describe("periodComparison", () => {
  const build = (c: number, p: number | null) => (p === null ? c : c - p);

  it("reads the page period and the preceding one", async () => {
    const read = vi.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(4);
    const fetchCard = periodComparison(read, build, -1);
    const result = await fetchCard("TUOD_V1", "30d", NOW);
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls[0]![0]).toBe("TUOD");
    expect(result).toEqual({ card: 6, error: null });
  });

  it("reads one period for all time", async () => {
    const read = vi.fn().mockResolvedValue(10);
    const result = await periodComparison(read, build, -1)(
      "TUOD_V1",
      "all",
      NOW,
    );
    expect(read).toHaveBeenCalledTimes(1);
    expect(result.card).toBe(10);
  });

  it("gives the empty card for an unknown ruleset and on a failed read", async () => {
    const read = vi.fn().mockRejectedValue(new Error("boom"));
    const fetchCard = periodComparison(read, build, -1);
    expect(await fetchCard("NOPE", "30d", NOW)).toEqual({
      card: -1,
      error: null,
    });
    expect(await fetchCard("TUOD_V1", "30d", NOW)).toEqual({
      card: -1,
      error: "boom",
    });
  });
});
