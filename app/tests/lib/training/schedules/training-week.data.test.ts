// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("@client/api/schedules", () => ({ getActiveSchedule: vi.fn() }));
vi.mock("@client/api/training-sessions", () => ({
  listTrainingCompletions: vi.fn(),
}));
import { getActiveSchedule } from "@client/api/schedules";
import { listTrainingCompletions } from "@client/api/training-sessions";
import { trainingWeek } from "@lib/training/schedules/training-week.data";
import type { TrainingWeekContext } from "@lib/types";

const SCHEDULE = {
  scheduleId: "s1",
  name: "My schedule",
  isActive: true,
  days: [1, 2, 4, 6].map((dayOfWeek) => ({
    dayOfWeek,
    routineId: `r${dayOfWeek}`,
    routineName: "Routine",
    routineMinutes: 20,
  })),
};

const MONDAY_RUN = {
  activityId: "a1",
  routineTemplateId: "r1",
  routineName: "Routine",
  completedAt: new Date(2024, 0, 1, 19).toISOString(),
};

async function loadedOn(now: Date): Promise<TrainingWeekContext> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  const week = trainingWeek() as TrainingWeekContext;
  await week.init();
  return week;
}

describe("trainingWeek", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads the schedule and this ISO week's completions", async () => {
    vi.mocked(getActiveSchedule).mockResolvedValue(SCHEDULE);
    vi.mocked(listTrainingCompletions).mockResolvedValue({
      items: [MONDAY_RUN],
      nextCursor: null,
    });

    const week = await loadedOn(new Date(2024, 0, 4, 12));

    expect(listTrainingCompletions).toHaveBeenCalledWith(
      new Date(2024, 0, 1).toISOString(),
    );
    expect(week.loading).toBe(false);
    expect(week.today).toBe(3);
    expect(week.hasSchedule()).toBe(true);
    expect(week.status(0)).toBe("done");
    expect(week.status(1)).toBe("missed");
    expect(week.counts()).toEqual({ done: 1, missed: 1, toGo: 2 });
  });

  it("labels each day with its name and status", async () => {
    vi.mocked(getActiveSchedule).mockResolvedValue(SCHEDULE);
    vi.mocked(listTrainingCompletions).mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    const week = await loadedOn(new Date(2024, 0, 4, 12));

    expect(week.dayLabel(1)).toMatch(/^\S+, missed$/);
    expect(week.letter(0)).toMatch(/^[a-z]$/);
  });

  it("styles each day by its status", async () => {
    vi.mocked(getActiveSchedule).mockResolvedValue(SCHEDULE);
    vi.mocked(listTrainingCompletions).mockResolvedValue({
      items: [MONDAY_RUN],
      nextCursor: null,
    });

    const week = await loadedOn(new Date(2024, 0, 4, 12));

    expect(week.dayClass(0)).toContain("bg-accent");
    expect(week.dayClass(1)).toContain("border-dashed");
    expect(week.dayClass(2)).toContain("text-faint-foreground");
    expect(week.dayClass(3)).toContain("home-day-today");
    expect(week.dayClass(5)).toContain("border-foreground/50");
  });

  it("takes a schedule saved from the edit modal", async () => {
    vi.mocked(getActiveSchedule).mockResolvedValue(null);
    vi.mocked(listTrainingCompletions).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    const week = await loadedOn(new Date(2024, 0, 4, 12));
    expect(week.hasSchedule()).toBe(false);

    week.applySaved(SCHEDULE);

    expect(week.hasSchedule()).toBe(true);
    expect(week.status(5)).toBe("scheduled");
    expect(week.counts().toGo).toBe(2);
  });

  it("falls back to no schedule when a read fails", async () => {
    vi.mocked(getActiveSchedule).mockRejectedValue(new Error("offline"));
    vi.mocked(listTrainingCompletions).mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    const week = await loadedOn(new Date(2024, 0, 4, 12));

    expect(week.loading).toBe(false);
    expect(week.hasSchedule()).toBe(false);
    expect(week.counts()).toEqual({ done: 0, missed: 0, toGo: 0 });
  });
});
