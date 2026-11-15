import { beforeEach, describe, expect, it, vi } from "vitest";

const loadGameSection = vi.fn();

vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { x01Overview } = await import("@lib/stats/sections/x01-overview.data");

const NOW = new Date("2026-10-01T10:00:00.000Z");
const PREVIOUS = ["2026-08-10T00:00:00.000Z", "2026-08-11T00:00:00.000Z"];
const CURRENT = ["2026-09-20T00:00:00.000Z", "2026-09-21T00:00:00.000Z"];

function bucket<M>([start, end]: string[], metrics: M) {
  return { start, end, closed: true, sampleSize: 1, metrics };
}

function scoring(points: number, darts: number) {
  return {
    points,
    darts,
    firstNinePoints: points,
    firstNineDarts: darts,
    bands: { ton: 0, tonForty: 0, oneEighty: 0 },
  };
}

type Responses = Record<string, unknown[]>;

function respond(map: Responses) {
  loadGameSection.mockImplementation(
    async (_game: string, id: string, range: { bucket: string }) => ({
      buckets:
        range.bucket === "none" ? (map[`${id}:best`] ?? []) : (map[id] ?? []),
    }),
  );
}

const callsFor = (id: string) =>
  loadGameSection.mock.calls.filter(([, section]) => section === id);

function overview() {
  const watchers: Record<string, () => void> = {};
  const page = {
    rangeKey: "30d" as "30d" | "90d" | "1y" | "all",
    variation: 501,
    game: "501_V1",
  };
  const own = x01Overview();
  const scope = new Proxy(page, {
    get: (target, key) =>
      key in own ? Reflect.get(own, key) : target[key as "rangeKey"],
    set: (target, key, value) => Reflect.set(target, key, value),
  });
  const s = Object.assign(own, {
    $data: scope,
    $watch: (key: string, cb: () => void) => {
      watchers[key] = cb;
    },
  });
  return { s, watchers, page };
}

beforeEach(() => {
  loadGameSection.mockReset();
  respond({});
});

describe("x01Overview load", () => {
  it("requests the four sections for 501 over a doubled day window with the variation", async () => {
    const { s } = overview();
    await s.load(NOW);
    for (const id of [
      "scoring-trend",
      "checkout-rate",
      "bust-rate",
      "leg-stats",
    ]) {
      expect(callsFor(id)).toHaveLength(1);
      const [game, , range] = callsFor(id)[0];
      expect(game).toBe("501");
      expect(range.bucket).toBe("day");
      expect(range.variation).toBe(501);
      expect(range.from).toBe("2026-08-02T10:00:00.000Z");
    }
  });

  it("derives averages and percent deltas against the previous period", async () => {
    respond({
      "scoring-trend": [
        bucket(PREVIOUS, scoring(150, 9)),
        bucket(CURRENT, scoring(180, 9)),
      ],
      "leg-stats": [
        bucket(PREVIOUS, { legs: { "20": 2 }, bestLeg: null }),
        bucket(CURRENT, { legs: { "15": 2, "18": 1 }, bestLeg: null }),
      ],
    });
    const { s } = overview();
    await s.load(NOW);
    expect(s.threeDart).toBe(60);
    expect(s.threeDartDelta).toBeCloseTo(20);
    expect(s.firstNine).toBe(60);
    expect(s.firstNineDelta).toBeCloseTo(20);
    expect(s.legAverage).toBe(16);
    expect(s.legAverageDelta).toBeCloseTo(-20);
    expect(s.isEmpty).toBe(false);
  });

  it("states checkout and bust in percent with point-change hints", async () => {
    respond({
      "checkout-rate": [
        bucket(PREVIOUS, { "40": { chances: 20, finished: 5 } }),
        bucket(CURRENT, { "40": { chances: 10, finished: 3 } }),
      ],
      "bust-rate": [
        bucket(PREVIOUS, { "60": { visits: 20, busts: 2 } }),
        bucket(CURRENT, { "60": { visits: 20, busts: 3 } }),
      ],
    });
    const { s } = overview();
    await s.load(NOW);
    expect(s.checkoutValue).toBe("30.0%");
    expect(s.checkoutHint).toBe("+5.0 pp");
    expect(s.bustValue).toBe("15.0%");
    expect(s.bustHint).toBe("+5.0 pp");
  });

  it("has no previous period for All Time: no deltas, empty hints", async () => {
    respond({
      "scoring-trend": [bucket(CURRENT, scoring(180, 9))],
      "checkout-rate": [
        bucket(CURRENT, { "40": { chances: 10, finished: 3 } }),
      ],
    });
    const { s, page } = overview();
    page.rangeKey = "all";
    await s.load(NOW);
    expect(s.threeDart).toBe(60);
    expect(s.threeDartDelta).toBeNull();
    expect(s.checkoutHint).toBe("");
    expect(s.bustHint).toBe("");
  });

  it("shows dashes and isEmpty for a variation with no sessions", async () => {
    const { s } = overview();
    await s.load(NOW);
    expect(s.threeDart).toBeNull();
    expect(s.checkoutValue).toBe("—");
    expect(s.bustValue).toBe("—");
    expect(s.legAverage).toBeNull();
    expect(s.isEmpty).toBe(true);
    expect(s.error).toBeNull();
  });

  it("keeps the other sections when one fails and names the failure", async () => {
    respond({
      "checkout-rate": [
        bucket(CURRENT, { "40": { chances: 10, finished: 3 } }),
      ],
    });
    const base = loadGameSection.getMockImplementation()!;
    loadGameSection.mockImplementation((game, id, range) =>
      id === "bust-rate"
        ? Promise.reject(new Error("boom"))
        : base(game, id, range),
    );
    const { s } = overview();
    await s.load(NOW);
    expect(s.error).toContain("bust-rate");
    expect(s.bustValue).toBe("—");
    expect(s.checkoutValue).toBe("30.0%");
    expect(s.loading).toBe(false);
  });

  it("drops a stale response resolved after a newer load", async () => {
    let releaseFirst!: (value: unknown) => void;
    loadGameSection.mockImplementationOnce(
      () => new Promise((resolve) => (releaseFirst = resolve)),
    );
    const { s } = overview();
    const first = s.load(NOW);
    respond({ "scoring-trend": [bucket(CURRENT, scoring(180, 9))] });
    await s.load(NOW);
    releaseFirst({ buckets: [bucket(CURRENT, scoring(30, 9))] });
    await first;
    expect(s.threeDart).toBe(60);
  });
});

describe("x01Overview best leg", () => {
  it("reads one all-time unbucketed leg-stats request with the variation", async () => {
    respond({
      "leg-stats:best": [
        bucket(CURRENT, { legs: {}, bestLeg: { darts: 21, sessionId: "a" } }),
        bucket(CURRENT, { legs: {}, bestLeg: { darts: 15, sessionId: "b" } }),
      ],
    });
    const { s } = overview();
    await s.loadBestLeg(NOW);
    const [game, id, range] = callsFor("leg-stats")[0];
    expect([game, id, range.bucket, range.variation]).toEqual([
      "501",
      "leg-stats",
      "none",
      501,
    ]);
    expect(s.bestLegValue).toBe("15");
    expect(s.bestLegSessionId).toBe("b");
    expect(s.bestLegLoading).toBe(false);
  });

  it("shows a dash and no session when there is no finished leg", async () => {
    const { s } = overview();
    await s.loadBestLeg(NOW);
    expect(s.bestLegValue).toBe("—");
    expect(s.bestLegSessionId).toBeNull();
  });
});

describe("x01Overview watchers", () => {
  it("reloads sections on rangeKey but not best leg", async () => {
    const { s, watchers } = overview();
    s.init();
    await vi.waitFor(() => expect(s.loading).toBe(false));
    const before = callsFor("leg-stats").length;
    watchers.rangeKey();
    await vi.waitFor(() =>
      expect(callsFor("leg-stats")).toHaveLength(before + 1),
    );
    expect(
      callsFor("leg-stats")
        .slice(before)
        .every(([, , r]) => r.bucket !== "none"),
    ).toBe(true);
  });

  it("re-sends sections and best leg with the new variation", async () => {
    const { s, watchers, page } = overview();
    s.init();
    await vi.waitFor(() => expect(s.loading).toBe(false));
    loadGameSection.mockClear();
    page.variation = 301;
    watchers.variation();
    await vi.waitFor(() => expect(loadGameSection).toHaveBeenCalledTimes(5));
    expect(
      loadGameSection.mock.calls.every(([, , r]) => r.variation === 301),
    ).toBe(true);
    expect(callsFor("leg-stats").some(([, , r]) => r.bucket === "none")).toBe(
      true,
    );
  });
});
