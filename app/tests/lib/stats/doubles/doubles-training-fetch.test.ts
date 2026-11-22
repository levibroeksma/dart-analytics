import { beforeEach, describe, expect, it, vi } from "vitest";

const loadGameSection = vi.fn();
vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const {
  EMPTY_CARD,
  loadDoublesTrainingCard,
  loadTargetInputs,
  loadTargetInputsOver,
} = await import("@lib/stats/doubles/doubles-training-fetch");

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
  beforeEach(() => {
    loadGameSection.mockReset();
  });

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

describe("loadTargetInputs", () => {
  beforeEach(() => {
    loadGameSection.mockReset();
  });

  it("reads the three sections un-bucketed for the game", async () => {
    loadGameSection.mockImplementation((_game: string, sectionId: string) =>
      series({ id: sectionId }),
    );
    const inputs = await loadTargetInputs("SHANGHAI", "30d", NOW);
    const calls = loadGameSection.mock.calls;
    expect(calls.map((call) => [call[0], call[1]])).toEqual([
      ["SHANGHAI", "target-accuracy"],
      ["SHANGHAI", "miss-direction"],
      ["SHANGHAI", "loose-darts"],
    ]);
    expect(calls[0]![2]).toMatchObject({ bucket: "none" });
    expect(inputs.accuracy[0]!.metrics).toEqual({ id: "target-accuracy" });
    expect(inputs.misses[0]!.metrics).toEqual({ id: "miss-direction" });
    expect(inputs.loose[0]!.metrics).toEqual({ id: "loose-darts" });
  });

  it("rejects when one section fails", async () => {
    failLooseDarts(new Error("range too wide"));
    await expect(loadTargetInputs("SHANGHAI", "30d", NOW)).rejects.toThrow(
      "range too wide",
    );
  });
});

describe("loadTargetInputsOver", () => {
  beforeEach(() => {
    loadGameSection.mockReset();
  });

  it("reads the three sections un-bucketed over the given span", async () => {
    loadGameSection.mockImplementation(() => series({}));
    const span = {
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-10-01T00:00:00.000Z",
    };
    await loadTargetInputsOver("ACE", span);
    expect(loadGameSection.mock.calls).toHaveLength(3);
    for (const call of loadGameSection.mock.calls) {
      expect(call[0]).toBe("ACE");
      expect(call[2]).toEqual({ ...span, bucket: "none" });
    }
  });
});
