// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  replayPath,
  replaySessionIdFromLocation,
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
});
