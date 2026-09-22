import { describe, it, expect } from "vitest";
import {
  isoWeekday,
  weekdayNames,
  todayEntry,
  startOfLocalDay,
  isRoutineCompleted,
} from "@lib/training/schedules/today";

describe("isoWeekday", () => {
  it("maps JS getDay() 0..6 to ISO 1..7, Sunday last", () => {
    expect(isoWeekday(new Date(2024, 0, 1))).toBe(1); // Monday
    expect(isoWeekday(new Date(2024, 0, 2))).toBe(2); // Tuesday
    expect(isoWeekday(new Date(2024, 0, 6))).toBe(6); // Saturday
    expect(isoWeekday(new Date(2024, 0, 7))).toBe(7); // Sunday
  });
});

describe("weekdayNames", () => {
  it("returns Monday..Sunday for the given locale", () => {
    expect(weekdayNames("en-GB")).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    expect(weekdayNames("en-GB")[0]).toBe("Monday");
  });
});

describe("todayEntry", () => {
  const SCHEDULE = {
    scheduleId: "s1",
    name: "Week",
    isActive: true,
    days: [
      {
        dayOfWeek: 1,
        routineId: "r-mon",
        routineName: "Mon",
        routineMinutes: 30,
      },
      {
        dayOfWeek: 3,
        routineId: "r-wed",
        routineName: "Wed",
        routineMinutes: 45,
      },
    ],
  };

  it("returns the matching day for the given date", () => {
    expect(todayEntry(SCHEDULE, new Date(2024, 0, 1))).toEqual(
      SCHEDULE.days[0],
    ); // Monday
  });

  it("returns null when the weekday has no entry (rest day)", () => {
    expect(todayEntry(SCHEDULE, new Date(2024, 0, 2))).toBeNull(); // Tuesday
  });

  it("returns null when there is no active schedule", () => {
    expect(todayEntry(null, new Date(2024, 0, 1))).toBeNull();
  });
});

describe("startOfLocalDay", () => {
  it("returns local midnight of the same calendar day", () => {
    const start = startOfLocalDay(new Date(2024, 0, 1, 17, 45, 12));
    expect(start).toEqual(new Date(2024, 0, 1, 0, 0, 0, 0));
  });
});

describe("isRoutineCompleted", () => {
  const ENTRY = {
    dayOfWeek: 1,
    routineId: "r1",
    routineName: "Warm-Up",
    routineMinutes: 30,
  };
  const completion = (routineTemplateId: string) => ({
    activityId: "a1",
    routineTemplateId,
    routineName: "x",
    completedAt: "2024-01-01T08:00:00.000Z",
  });

  it("is true when a completion ran the entry's routine", () => {
    expect(isRoutineCompleted(ENTRY, [completion("r1")])).toBe(true);
  });

  it("is false when only other routines were completed", () => {
    expect(isRoutineCompleted(ENTRY, [completion("r2")])).toBe(false);
  });

  it("is false without an entry", () => {
    expect(isRoutineCompleted(null, [completion("r1")])).toBe(false);
  });
});
