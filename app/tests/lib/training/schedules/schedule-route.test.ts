// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  scheduleIdFromLocation,
  scheduleEditPath,
} from "@lib/training/schedules/schedule-route";

describe("schedule routes", () => {
  it("reads ?schedule= from the location, null when absent or blank", () => {
    history.replaceState(null, "", "/training/schedules/edit?schedule=sc-1");
    expect(scheduleIdFromLocation()).toBe("sc-1");
    history.replaceState(null, "", "/training/schedules/edit?schedule=");
    expect(scheduleIdFromLocation()).toBeNull();
    history.replaceState(null, "", "/training/schedules/edit");
    expect(scheduleIdFromLocation()).toBeNull();
  });

  it("builds the encoded edit path", () => {
    expect(scheduleEditPath("a b")).toBe(
      "/training/schedules/edit?schedule=a%20b",
    );
    expect(scheduleEditPath("sc")).toBe("/training/schedules/edit?schedule=sc");
  });
});
