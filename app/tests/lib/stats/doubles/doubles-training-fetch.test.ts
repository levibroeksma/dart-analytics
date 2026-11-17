import { beforeEach, describe, expect, it, vi } from "vitest";

const loadGameSection = vi.fn();
vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { EMPTY_CARD, loadDoublesTrainingCard } =
  await import("@lib/stats/doubles/doubles-training-fetch");

const NOW = new Date("2026-11-17T12:00:00Z");
function series<M>(metrics: M) {
  return {
    buckets: [{ start: "a", end: "b", closed: true, sampleSize: 1, metrics }],
  };
}

function failLooseDarts(reason: unknown) {
  loadGameSection.mockImplementation((_game: string, sectionId: string) =>
    sectionId === "loose-darts" ? Promise.reject(reason) : series({}),
  );
}

describe("loadDoublesTrainingCard", () => {
  beforeEach(() => loadGameSection.mockReset());

  it("joins the three sections into a card with no error", async () => {
    loadGameSection.mockImplementation((_game: string, sectionId: string) =>
      sectionId === "target-accuracy"
        ? series({ "DOUBLE:5": { attempts: 12, hits: 6 } })
        : series({}),
    );
    const result = await loadDoublesTrainingCard("30d", NOW);
    expect(result.error).toBeNull();
    expect(result.card.rows.map((row) => row.aim)).toEqual(["DOUBLE:5"]);
  });

  it("gives the empty card and the message when a section fails", async () => {
    failLooseDarts(new Error("range too wide"));
    expect(await loadDoublesTrainingCard("30d", NOW)).toEqual({
      card: EMPTY_CARD,
      error: "range too wide",
    });
  });

  it("falls back to a generic message for a non-error rejection", async () => {
    failLooseDarts("boom");
    expect((await loadDoublesTrainingCard("30d", NOW)).error).toBe(
      "load failed",
    );
  });
});
