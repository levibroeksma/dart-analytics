import { beforeEach, describe, it, expect, vi } from "vitest";

const fetchStatisticsOverview = vi.fn();

vi.mock("@client/api/statistics", () => ({
  fetchStatisticsOverview: () => fetchStatisticsOverview(),
}));

const { barHeight, careerTiles, dailyBars, dailyPeak, homeSnapshot } =
  await import("@lib/home/home-snapshot.data");

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
  it("carries the design fixture", () => {
    const s = homeSnapshot();
    expect(s.hero.value).toBe("72.4");
    expect(s.dailyAverage.map((d) => d.day).join("")).toBe("MTWTFSS");
    expect(s.peak).toBe("74.10");
  });

  it("highlights Friday in the fixture", () => {
    const s = homeSnapshot();
    const peaks = s.bars.filter((b) => b.peak).map((b) => b.day);
    expect(peaks).toEqual(["F"]);
    expect(s.bars).toHaveLength(7);
  });

  it("keeps every heat stamp inside the board canvas", () => {
    const { stamps } = homeSnapshot().landing;
    expect(stamps.length).toBeGreaterThan(0);
    for (const s of stamps) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1);
      expect(s.radius).toBeGreaterThan(0);
      expect(s.alpha).toBeGreaterThan(0);
    }
  });

  it("navigates to the resume target", () => {
    const s = homeSnapshot();
    const navigate = vi.fn();
    s.navigate = navigate;
    s.resumeGame();
    expect(navigate).toHaveBeenCalledWith("/games");
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
    const s = homeSnapshot();
    await s.init();
    expect(s.careerTiles.map((t) => t.value)).toEqual(["—", "—", "—"]);
  });
});
