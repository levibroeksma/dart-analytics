import { beforeEach, describe, it, expect, vi } from "vitest";

const fetchStatisticsOverview = vi.fn();
const fetchStatisticsHome = vi.fn();

vi.mock("@client/api/statistics", () => ({
  fetchStatisticsOverview: () => fetchStatisticsOverview(),
  fetchStatisticsHome: (tz: string) => fetchStatisticsHome(tz),
}));

const {
  barHeight,
  careerTiles,
  dailyBars,
  dailyFromStats,
  dailyPeak,
  heroFromStats,
  homeSnapshot,
  landingFromStats,
} = await import("@lib/home/home-snapshot.data");

const OVERVIEW = {
  totalGamesPlayed: 12,
  totalPlayTimeSeconds: 3600,
  favoriteGameTypeKey: "501",
  longestPlayStreakDays: 3,
  currentPlayStreakDays: 1,
  totalDartsThrown: 18342,
  hundredPlusCount: 10,
  oneTwentyPlusCount: 5,
  oneFortyPlusCount: 2,
  oneEightiesCount: 1,
  medianVisitScore: 45,
  highestGameAverage: 84.64,
  firstNineCareerAverage: 50.2,
  scoringAverageExcludingDoubles: 48.1,
  bestLegDarts: 15,
  averageDartsPerLeg: 18.5,
  checkoutPercentage: 0.4,
  highestCheckout: {
    value: 121,
    timesHit: 1,
    sessionId: "0190a000-0000-7000-8000-000000000001",
  },
};

beforeEach(() => {
  fetchStatisticsOverview.mockReset();
  fetchStatisticsHome.mockReset();
});

const HOME = {
  firstNine: { current: 72.43, previous: 70.6, delta: 1.83 },
  daily: [
    { date: "2026-10-19", weekday: 1, value: 61.2 },
    { date: "2026-10-20", weekday: 2, value: null },
    { date: "2026-10-21", weekday: 3, value: 74.1 },
    { date: "2026-10-22", weekday: 4, value: null },
    { date: "2026-10-23", weekday: 5, value: null },
    { date: "2026-10-24", weekday: 6, value: null },
    { date: "2026-10-25", weekday: 7, value: 70 },
  ],
  landing: {
    cellMm: 4,
    cells: [
      [0, -26, 38],
      [1, -26, 24],
    ] as [number, number, number][],
  },
};

describe("heroFromStats", () => {
  it("formats value and an upward delta", () => {
    expect(heroFromStats(HOME)).toEqual({
      label: "FIRST-9 AVERAGE",
      value: "72.4",
      delta: "1.8",
      direction: "Up",
      showDelta: true,
      window: "last 30 days",
    });
  });

  it("says Down with the absolute delta", () => {
    const hero = heroFromStats({
      ...HOME,
      firstNine: { current: 70, previous: 71.5, delta: -1.5 },
    });
    expect(hero).toMatchObject({
      direction: "Down",
      delta: "1.5",
      showDelta: true,
    });
  });

  it("hides the delta when it is null or rounds to 0.0", () => {
    const none = heroFromStats({
      ...HOME,
      firstNine: { current: 70, previous: null, delta: null },
    });
    expect(none).toMatchObject({ value: "70.0", showDelta: false });
    const flat = heroFromStats({
      ...HOME,
      firstNine: { current: 70, previous: 70.04, delta: -0.04 },
    });
    expect(flat.showDelta).toBe(false);
  });

  it("is a dash with no stats", () => {
    expect(heroFromStats(null)).toMatchObject({ value: "—", showDelta: false });
    expect(
      heroFromStats({
        ...HOME,
        firstNine: { current: null, previous: null, delta: null },
      }).value,
    ).toBe("—");
  });
});

describe("dailyFromStats", () => {
  it("labels days by weekday letter and keeps empty days null", () => {
    const days = dailyFromStats(HOME);
    expect(days.map((d) => d.day).join("")).toBe("MTWTFSS");
    expect(days.map((d) => d.value)).toEqual([
      61.2,
      null,
      74.1,
      null,
      null,
      null,
      70,
    ]);
  });

  it("is empty with no stats", () => {
    expect(dailyFromStats(null)).toEqual([]);
  });
});

describe("daily bars with empty days", () => {
  it("skips empty days for the peak and gives them no height", () => {
    const days = dailyFromStats(HOME);
    expect(dailyPeak(days)).toBe("74.10");
    const bars = dailyBars(days);
    expect(bars.map((b) => b.peak)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(bars[1].height).toBe("0%");
  });

  it("has a dash peak and no peak bar when every day is empty", () => {
    const days = dailyFromStats({
      ...HOME,
      daily: HOME.daily.map((d) => ({ ...d, value: null })),
    });
    expect(dailyPeak(days)).toBe("—");
    expect(dailyBars(days).some((b) => b.peak)).toBe(false);
  });
});

describe("landingFromStats", () => {
  it("builds stamps from the cells", () => {
    const { stamps, window } = landingFromStats(HOME);
    expect(window).toBe("LAST 30 DAYS");
    expect(stamps.length).toBeGreaterThan(0);
    for (const s of stamps) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1);
    }
  });

  it("has no stamps with no cells or no stats", () => {
    expect(landingFromStats(null).stamps).toEqual([]);
    expect(
      landingFromStats({ ...HOME, landing: { cellMm: 4, cells: [] } }).stamps,
    ).toEqual([]);
  });
});

describe("homeSnapshot init", () => {
  it("starts empty: dash hero, no bars, no stamps", () => {
    const s = homeSnapshot();
    expect(s.hero.value).toBe("—");
    expect(s.bars).toEqual([]);
    expect(s.peak).toBe("—");
    expect(s.landing.stamps).toEqual([]);
  });

  it("fills hero, bars and landing from the home stats", async () => {
    fetchStatisticsOverview.mockResolvedValue(OVERVIEW);
    fetchStatisticsHome.mockResolvedValue(HOME);
    const s = homeSnapshot();
    await s.init();
    expect(s.hero.value).toBe("72.4");
    expect(s.bars).toHaveLength(7);
    expect(s.peak).toBe("74.10");
    expect(s.landing.stamps.length).toBeGreaterThan(0);
    expect(fetchStatisticsHome).toHaveBeenCalledWith(expect.any(String));
  });

  it("degrades each fetch independently", async () => {
    fetchStatisticsOverview.mockRejectedValue(new Error("down"));
    fetchStatisticsHome.mockResolvedValue(HOME);
    const s = homeSnapshot();
    await s.init();
    expect(s.careerTiles.map((t) => t.value)).toEqual(["—", "—", "—"]);
    expect(s.hero.value).toBe("72.4");

    fetchStatisticsOverview.mockResolvedValue(OVERVIEW);
    fetchStatisticsHome.mockRejectedValue(new Error("down"));
    const t = homeSnapshot();
    await t.init();
    expect(t.careerTiles[0].value).toBe("84.6");
    expect(t.hero.value).toBe("—");
    expect(t.bars).toEqual([]);
  });
});

describe("careerTiles", () => {
  it("keeps the three tile titles in order", () => {
    expect(careerTiles(null).map((t) => t.key)).toEqual([
      "BEST AVG",
      "TOP OUT",
      "DARTS",
    ]);
  });

  it("is dashes with no overview", () => {
    expect(careerTiles(null).map((t) => t.value)).toEqual(["—", "—", "—"]);
  });

  it("formats the overview", () => {
    expect(careerTiles(OVERVIEW)).toEqual([
      { key: "BEST AVG", value: "84.6", hint: "Career" },
      { key: "TOP OUT", value: "121", hint: "Hit 1×" },
      { key: "DARTS", value: "18,342", hint: "Career" },
    ]);
  });

  it("dashes a missing checkout and a zero average", () => {
    const tiles = careerTiles({
      ...OVERVIEW,
      highestGameAverage: 0,
      highestCheckout: null,
    });
    expect(tiles[0].value).toBe("—");
    expect(tiles[1]).toEqual({ key: "TOP OUT", value: "—", hint: "Career" });
  });
});

describe("dailyPeak", () => {
  it("formats the max to two decimals", () => {
    expect(
      dailyPeak([
        { day: "M", value: 61.2 },
        { day: "T", value: 74.1 },
      ]),
    ).toBe("74.10");
  });

  it("is a dash with no days", () => {
    expect(dailyPeak([])).toBe("—");
  });
});

describe("barHeight", () => {
  it("maps 50–75 onto 0–100%", () => {
    expect(barHeight(50)).toBe("0%");
    expect(barHeight(62.5)).toBe("50%");
    expect(barHeight(75)).toBe("100%");
  });

  it("clamps outside the range", () => {
    expect(barHeight(45)).toBe("0%");
    expect(barHeight(80)).toBe("100%");
  });
});

describe("dailyBars", () => {
  it("marks every max-valued day as peak", () => {
    const bars = dailyBars([
      { day: "M", value: 70 },
      { day: "T", value: 74.1 },
      { day: "W", value: 74.1 },
    ]);
    expect(bars.map((b) => b.peak)).toEqual([false, true, true]);
    expect(bars[0].height).toBe("80%");
  });

  it("is empty with no days", () => {
    expect(dailyBars([])).toEqual([]);
  });
});

describe("homeSnapshot", () => {
  it("leaves resuming to the resume deck", () => {
    const s = homeSnapshot();
    expect(s).not.toHaveProperty("resume");
    expect(s).not.toHaveProperty("resumeGame");
    expect(s).not.toHaveProperty("navigate");
  });

  it("starts career tiles as dashes", () => {
    expect(homeSnapshot().careerTiles.map((t) => t.value)).toEqual([
      "—",
      "—",
      "—",
    ]);
  });

  it("fills career tiles from the overview on init", async () => {
    fetchStatisticsOverview.mockResolvedValue(OVERVIEW);
    fetchStatisticsHome.mockResolvedValue(HOME);
    const s = homeSnapshot();
    await s.init();
    expect(s.careerTiles.map((t) => t.value)).toEqual([
      "84.6",
      "121",
      "18,342",
    ]);
  });

  it("keeps the dashes when the overview fails", async () => {
    fetchStatisticsOverview.mockRejectedValue(new Error("down"));
    fetchStatisticsHome.mockResolvedValue(HOME);
    const s = homeSnapshot();
    await s.init();
    expect(s.careerTiles.map((t) => t.value)).toEqual(["—", "—", "—"]);
  });
});
