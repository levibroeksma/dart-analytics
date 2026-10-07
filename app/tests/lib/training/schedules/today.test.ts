import { describe, it, expect } from "vitest";
import {
  isoWeekday,
  weekdayNames,
  todayEntry,
  startOfLocalDay,
  isRoutineCompleted,
  startOfIsoWeek,
  dayStatus,
  weekCounts,
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

const weekSchedule = (weekdays: number[]) =>
  ({
    scheduleId: "s1",
    name: "My schedule",
    days: weekdays.map((dayOfWeek) => ({
      dayOfWeek,
      routineId: `r${dayOfWeek}`,
      routineName: "Routine",
      routineMinutes: 10,
    })),
  }) as any;

const doneOn = (dayOfWeek: number, at: Date) => ({
  activityId: `a${dayOfWeek}`,
  routineTemplateId: `r${dayOfWeek}`,
  routineName: "Routine",
  completedAt: at.toISOString(),
});

describe("startOfIsoWeek", () => {
  it("returns local Monday midnight of the date's week", () => {
    expect(startOfIsoWeek(new Date(2024, 0, 4, 15))).toEqual(
      new Date(2024, 0, 1),
    );
    expect(startOfIsoWeek(new Date(2024, 0, 7, 23))).toEqual(
      new Date(2024, 0, 1),
    );
    expect(startOfIsoWeek(new Date(2024, 0, 1, 0))).toEqual(
      new Date(2024, 0, 1),
    );
  });
});

describe("dayStatus / weekCounts", () => {
  const schedule = weekSchedule([1, 2, 4, 6]);
  const mondayDone = [doneOn(1, new Date(2024, 0, 1, 19))];

  it("reads every status for a Thursday", () => {
    expect(
      [0, 1, 2, 3, 4, 5, 6].map((index) =>
        dayStatus(index, 3, schedule, mondayDone),
      ),
    ).toEqual(["done", "missed", "rest", "today", "rest", "scheduled", "rest"]);
  });

  it("counts done, missed and to go, today included", () => {
    expect(weekCounts(3, schedule, mondayDone)).toEqual({
      done: 1,
      missed: 1,
      toGo: 2,
    });
  });

  it("marks today done once its routine is completed", () => {
    const both = [...mondayDone, doneOn(4, new Date(2024, 0, 4, 9))];

    expect(dayStatus(3, 3, schedule, both)).toBe("done");
    expect(weekCounts(3, schedule, both)).toEqual({
      done: 2,
      missed: 1,
      toGo: 1,
    });
  });

  it("keeps a rest-day today as today without counting it to go", () => {
    expect(dayStatus(2, 2, schedule, [])).toBe("today");
    expect(weekCounts(2, schedule, [])).toEqual({
      done: 0,
      missed: 2,
      toGo: 2,
    });
  });

  it("needs the routine completed on that same day", () => {
    const tuesdayRun = [doneOn(1, new Date(2024, 0, 2, 9))];

    expect(dayStatus(0, 3, schedule, tuesdayRun)).toBe("missed");
  });

  it("shows rest everywhere but today without a schedule", () => {
    expect(dayStatus(0, 3, null, [])).toBe("rest");
    expect(dayStatus(3, 3, null, [])).toBe("today");
    expect(weekCounts(3, null, [])).toEqual({ done: 0, missed: 0, toGo: 0 });
  });
});
