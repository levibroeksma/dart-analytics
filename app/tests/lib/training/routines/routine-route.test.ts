// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  routineIdFromLocation,
  routineDetailPath,
  routinePlayPath,
  routineEditPath,
} from "@lib/training/routines/routine-route";

describe("routine routes", () => {
  it("reads ?routine= from the location, null when absent or blank", () => {
    history.replaceState(null, "", "/training/routines/detail?routine=rt-1");
    expect(routineIdFromLocation()).toBe("rt-1");
    history.replaceState(null, "", "/training/routines/detail?routine=");
    expect(routineIdFromLocation()).toBeNull();
    history.replaceState(null, "", "/training/routines/detail");
    expect(routineIdFromLocation()).toBeNull();
  });

  it("reads ?routine= beside other params", () => {
    history.replaceState(
      null,
      "",
      "/training/routines/detail?lives=3&routine=rt-2",
    );
    expect(routineIdFromLocation()).toBe("rt-2");
  });

  it("builds encoded paths", () => {
    expect(routineDetailPath("a b")).toBe(
      "/training/routines/detail?routine=a%20b",
    );
    expect(routinePlayPath("rt")).toBe("/training/routines/play?routine=rt");
    expect(routineEditPath("rt")).toBe("/training/routines/edit?routine=rt");
  });
});
