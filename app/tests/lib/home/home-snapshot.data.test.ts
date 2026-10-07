import { describe, it, expect, vi } from "vitest";
import {
  barHeight,
  dailyBars,
  dailyPeak,
  homeSnapshot,
} from "@lib/home/home-snapshot.data";

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
    expect(s.careerTiles).toHaveLength(3);
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
});
