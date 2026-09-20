import { describe, it, expect } from "vitest";
import {
  ScheduleDayInput,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  ScheduleDay,
  ScheduleResponse,
  ScheduleSummary,
  ScheduleListResponse,
} from "@routes/schedules/types";

const day = { dayOfWeek: 1, routineTemplateId: "rt-1" };

describe("ScheduleDayInput", () => {
  it("accepts a weekday 1..7 and a non-empty routineTemplateId", () => {
    expect(ScheduleDayInput.safeParse(day).success).toBe(true);
  });

  it("rejects weekday 0 and weekday 8", () => {
    expect(ScheduleDayInput.safeParse({ ...day, dayOfWeek: 0 }).success).toBe(
      false,
    );
    expect(ScheduleDayInput.safeParse({ ...day, dayOfWeek: 8 }).success).toBe(
      false,
    );
  });

  it("rejects an empty routineTemplateId", () => {
    expect(
      ScheduleDayInput.safeParse({ ...day, routineTemplateId: "" }).success,
    ).toBe(false);
  });
});

describe("CreateScheduleRequest", () => {
  it("accepts a trimmed name and up to 7 days", () => {
    const parsed = CreateScheduleRequest.safeParse({
      name: " Mine ",
      days: [day],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.name).toBe("Mine");
  });

  it("accepts zero days (an all-rest schedule)", () => {
    expect(
      CreateScheduleRequest.safeParse({ name: "Rest week", days: [] }).success,
    ).toBe(true);
  });

  it("rejects a blank name and more than 7 days", () => {
    expect(
      CreateScheduleRequest.safeParse({ name: "   ", days: [] }).success,
    ).toBe(false);
    expect(
      CreateScheduleRequest.safeParse({
        name: "Mine",
        days: Array(8).fill(day),
      }).success,
    ).toBe(false);
  });
});

describe("UpdateScheduleRequest", () => {
  it("is the same shape as CreateScheduleRequest", () => {
    expect(UpdateScheduleRequest).toBe(CreateScheduleRequest);
  });
});

describe("ScheduleDay / ScheduleResponse", () => {
  it("accepts a full schedule response", () => {
    const parsed = ScheduleResponse.safeParse({
      scheduleId: "s1",
      name: "Mine",
      isActive: true,
      days: [
        {
          dayOfWeek: 1,
          routineId: "rt-1",
          routineName: "Warm-Up",
          routineMinutes: 30,
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a day missing routineMinutes", () => {
    expect(
      ScheduleDay.safeParse({
        dayOfWeek: 1,
        routineId: "rt-1",
        routineName: "Warm-Up",
      }).success,
    ).toBe(false);
  });
});

describe("ScheduleSummary / ScheduleListResponse", () => {
  it("accepts a summary and a list of summaries", () => {
    const summary = {
      scheduleId: "s1",
      name: "Mine",
      isActive: false,
      dayCount: 3,
    };
    expect(ScheduleSummary.safeParse(summary).success).toBe(true);
    expect(
      ScheduleListResponse.safeParse({ items: [summary], nextCursor: null })
        .success,
    ).toBe(true);
  });
});
