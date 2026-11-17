import { beforeEach, describe, expect, it, vi } from "vitest";
import { heatmapWindow } from "@lib/stats/sections/score-trend-window";

const loadGameSection = vi.fn();
vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { doublesTrainingCardSection } =
  await import("@lib/stats/sections/doubles-training-card.data");

const NOW = new Date("2026-11-17T12:00:00Z");

function series<M>(metrics: M) {
  return {
    buckets: [{ start: "a", end: "b", closed: true, sampleSize: 1, metrics }],
  };
}

function respond(bySection: Record<string, unknown>) {
  loadGameSection.mockImplementation(
    (_game: string, sectionId: string) => bySection[sectionId],
  );
}

function scope(game = "DOUBLES_TRAINING_V1") {
  return Object.assign(doublesTrainingCardSection(), {
    $data: { rangeKey: "30d" as const, game, variation: 0 },
    $watch: () => {},
  });
}

const D16 = {
  "target-accuracy": series({ "DOUBLE:16": { attempts: 40, hits: 20 } }),
  "miss-direction": series({
    "DOUBLE:16": [
      { sector: 7, radial: "INSIDE", darts: 6 },
      { sector: 3, radial: "OUTSIDE", darts: 4 },
      { sector: 0, radial: "WITHIN", darts: 5 },
      { sector: 4, radial: "WITHIN", darts: 5 },
    ],
  }),
  "loose-darts": series({
    "DOUBLE:16": { onTarget: 20, nearMiss: 12, loose: 6 },
  }),
};

describe("doublesTrainingCardSection", () => {
  beforeEach(() => loadGameSection.mockReset());

  it("loads the three sections un-bucketed over the period", async () => {
    respond(D16);
    await scope().load(NOW);
    const window = heatmapWindow("30d", NOW);
    expect(loadGameSection.mock.calls.map((call) => call[1])).toEqual([
      "target-accuracy",
      "miss-direction",
      "loose-darts",
    ]);
    for (const call of loadGameSection.mock.calls) {
      expect(call[0]).toBe("DOUBLES_TRAINING");
      expect(call[2]).toMatchObject({ ...window, bucket: "none" });
    }
  });

  it("exposes headline, caption and overlay lines", async () => {
    respond(D16);
    const s = scope();
    await s.load(NOW);
    expect(s.headline).toBe("50.0%");
    expect(s.caption).toBe("Favourite D16, 40 darts");
    expect(s.table).toEqual([
      {
        label: "D16",
        count: 40,
        cells: ["50.0%", "6/4", "5/5", "6/10/4", "12/6"],
      },
    ]);
  });

  it("shows a dash and a waiting caption with no darts", async () => {
    respond({
      "target-accuracy": series({}),
      "miss-direction": series({}),
      "loose-darts": series({}),
    });
    const s = scope();
    await s.load(NOW);
    expect(s.headline).toBe("—");
    expect(s.caption).toBe("Not enough darts yet");
    expect(s.table).toEqual([]);
  });

  it("reports a failing section as the error with no partial card", async () => {
    loadGameSection.mockImplementation((_game: string, sectionId: string) =>
      sectionId === "loose-darts"
        ? Promise.reject(new Error("range too wide"))
        : D16[sectionId as keyof typeof D16],
    );
    const s = scope();
    await s.load(NOW);
    expect(s.error).toBe("range too wide");
    expect(s.card.rows).toEqual([]);
    expect(s.loading).toBe(false);
  });

  it("drops a response that arrives after a newer load", async () => {
    let release: (value: unknown) => void = () => {};
    const slow = new Promise((resolve) => (release = resolve));
    loadGameSection.mockImplementationOnce(() => slow);
    loadGameSection.mockImplementation(
      (_game: string, sectionId: string) => D16[sectionId as keyof typeof D16],
    );
    const s = scope();
    const first = s.load(NOW);
    respond({
      "target-accuracy": series({ "DOUBLE:1": { attempts: 12, hits: 6 } }),
      "miss-direction": series({}),
      "loose-darts": series({}),
    });
    await s.load(NOW);
    release(series({ "DOUBLE:16": { attempts: 99, hits: 99 } }));
    await first;
    expect(s.card.rows.map((row) => row.aim)).toEqual(["DOUBLE:1"]);
  });

  it("finishes loading with no error after a good read", async () => {
    respond(D16);
    const s = scope();
    await s.load(NOW);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
    expect(s.card.favourite?.aim).toBe("DOUBLE:16");
  });

  it("reads over the period the page holds when it loads", async () => {
    respond(D16);
    const s = scope();
    s.$data.rangeKey = "90d" as never;
    await s.load(NOW);
    const window = heatmapWindow("90d", NOW);
    for (const call of loadGameSection.mock.calls)
      expect(call[2]).toMatchObject({ ...window, bucket: "none" });
  });
});
