import { describe, it, expect } from "vitest";
import { formatScheduleIssues } from "@lib/training/schedules/schedule-issues";

describe("formatScheduleIssues", () => {
  it("uses the reason alone when no weekday is named", () => {
    expect(formatScheduleIssues({ reason: "duplicate dayOfWeek" })).toEqual([
      "duplicate dayOfWeek",
    ]);
  });

  it("appends the weekday when the envelope names one", () => {
    expect(
      formatScheduleIssues({
        reason: "unknown routineTemplateId",
        dayOfWeek: 3,
      }),
    ).toEqual(["unknown routineTemplateId (day 3)"]);
  });

  it("falls back to a generic line without details or a string reason", () => {
    expect(formatScheduleIssues(undefined)).toEqual([
      "The schedule was not accepted.",
    ]);
    expect(formatScheduleIssues({ reason: 4 })).toEqual([
      "The schedule was not accepted.",
    ]);
  });
});
