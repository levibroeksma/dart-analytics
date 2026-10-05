// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { routinesLocationFromLocation } from "@lib/stats/replay-route";

describe("replay routes", () => {
  it("round-trips the routines location", () => {
    history.replaceState(
      null,
      "",
      "/statistics?tab=routines&routine=r%201&step=s%2F2",
    );
    expect(routinesLocationFromLocation()).toEqual({
      routineKey: "r 1",
      stepKey: "s/2",
    });
    history.replaceState(null, "", "/statistics?tab=routines&routine=r%201");
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
