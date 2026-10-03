// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  replayPath,
  replaySessionIdFromLocation,
  routinesLocationFromLocation,
  statisticsPath,
} from "@lib/stats/replay-route";

describe("replay routes", () => {
  it("builds the encoded replay path", () => {
    expect(replayPath("01900000-0000-7000-8000-00000000a001")).toBe(
      "/statistics/replay?session=01900000-0000-7000-8000-00000000a001",
    );
    expect(replayPath("a b/c")).toBe("/statistics/replay?session=a%20b%2Fc");
  });

  it("round-trips an id through the location", () => {
    history.replaceState(null, "", replayPath("a b/c"));
    expect(replaySessionIdFromLocation()).toBe("a b/c");
  });

  it("reads null for an empty, blank or absent ?session=", () => {
    history.replaceState(null, "", "/statistics/replay?session=");
    expect(replaySessionIdFromLocation()).toBeNull();
    history.replaceState(null, "", "/statistics/replay?session=%20");
    expect(replaySessionIdFromLocation()).toBeNull();
    history.replaceState(null, "", "/statistics/replay");
    expect(replaySessionIdFromLocation()).toBeNull();
  });

  it("builds the statistics path, carrying the routine and step when given", () => {
    expect(statisticsPath(null, null)).toBe("/statistics");
    expect(statisticsPath("r 1", null)).toBe(
      "/statistics?tab=routines&routine=r%201",
    );
    expect(statisticsPath("r 1", "s/2")).toBe(
      "/statistics?tab=routines&routine=r%201&step=s%2F2",
    );
    expect(statisticsPath(null, "s2")).toBe("/statistics");
  });

  it("round-trips the routines location", () => {
    history.replaceState(null, "", statisticsPath("r 1", "s/2"));
    expect(routinesLocationFromLocation()).toEqual({
      routineKey: "r 1",
      stepKey: "s/2",
    });
    history.replaceState(null, "", statisticsPath("r 1", null));
    expect(routinesLocationFromLocation()).toEqual({
      routineKey: "r 1",
      stepKey: null,
    });
  });

  it("reads null unless the routines tab names a routine", () => {
    history.replaceState(null, "", "/statistics");
    expect(routinesLocationFromLocation()).toBeNull();
    history.replaceState(null, "", "/statistics?tab=games&routine=r1");
    expect(routinesLocationFromLocation()).toBeNull();
    history.replaceState(null, "", "/statistics?tab=routines");
    expect(routinesLocationFromLocation()).toBeNull();
    history.replaceState(null, "", "/statistics?tab=routines&routine=%20");
    expect(routinesLocationFromLocation()).toBeNull();
  });
});
