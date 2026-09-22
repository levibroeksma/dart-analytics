// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("@client/api/schedules", () => ({ getActiveSchedule: vi.fn() }));
vi.mock("@client/api/training-sessions", () => ({
  listTrainingCompletions: vi.fn(),
}));
import { getActiveSchedule } from "@client/api/schedules";
import { listTrainingCompletions } from "@client/api/training-sessions";
import { homeWeek } from "@lib/training/schedules/home-week.data";
import type { HomeWeekContext } from "@lib/types";

const SCHEDULE = {
  scheduleId: "s1",
  name: "Week",
  isActive: true,
  days: [
    {
      dayOfWeek: 1,
      routineId: "r1",
      routineName: "Warm-Up",
      routineMinutes: 30,
    },
    {
      dayOfWeek: 3,
      routineId: "r3",
      routineName: "Doubles",
      routineMinutes: 20,
    },
  ],
};
const COMPLETION = (routineTemplateId: string) => ({
  activityId: "a1",
  routineTemplateId,
  routineName: "x",
  completedAt: "2024-01-01T08:00:00.000Z",
});

async function loaded(
  now: Date,
  completions: ReturnType<typeof COMPLETION>[] = [],
  schedule: typeof SCHEDULE | null = SCHEDULE,
) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  vi.mocked(getActiveSchedule).mockResolvedValue(schedule);
  vi.mocked(listTrainingCompletions).mockResolvedValue({
    items: completions,
    nextCursor: null,
  });
  const data: HomeWeekContext = homeWeek();
  await data.init();
  return data;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe("homeWeek", () => {
  it("asks for completions since local midnight", async () => {
    await loaded(new Date(2024, 0, 1, 15, 30));
    expect(listTrainingCompletions).toHaveBeenCalledWith(
      new Date(2024, 0, 1).toISOString(),
    );
  });

  it("marks today and the days with a routine", async () => {
    const data = await loaded(new Date(2024, 0, 3, 9)); // Wednesday
    expect(data.today).toBe(2);
    expect(data.isToday(2)).toBe(true);
    expect(data.hasRoutine(0)).toBe(true);
    expect(data.hasRoutine(1)).toBe(false);
    expect(data.hasRoutine(2)).toBe(true);
  });

  it("has no entry for today on a rest day", async () => {
    const data = await loaded(new Date(2024, 0, 2, 9)); // Tuesday
    expect(data.isToday(1)).toBe(true);
    expect(data.hasRoutine(1)).toBe(false);
    expect(data.todayEntry()).toBeNull();
    expect(data.showStart()).toBe(false);
    expect(data.showDone()).toBe(false);
  });

  it("offers today's routine until it has been completed", async () => {
    const data = await loaded(new Date(2024, 0, 1, 9), [COMPLETION("r9")]);
    expect(data.todayEntry()?.routineId).toBe("r1");
    expect(data.showStart()).toBe(true);
    expect(data.showDone()).toBe(false);
    expect(data.startHref()).toBe("/training/routines/play?routine=r1");
  });

  it("shows the completion state once today's routine is done", async () => {
    const data = await loaded(new Date(2024, 0, 1, 9), [COMPLETION("r1")]);
    expect(data.showStart()).toBe(false);
    expect(data.showDone()).toBe(true);
  });

  it("shows nothing and maps no day without an active schedule", async () => {
    const data = await loaded(new Date(2024, 0, 1, 9), [], null);
    expect(data.hasRoutine(0)).toBe(false);
    expect(data.showStart()).toBe(false);
    expect(data.showDone()).toBe(false);
  });

  it("hides the today card when loading fails", async () => {
    vi.mocked(getActiveSchedule).mockRejectedValue(new Error("offline"));
    vi.mocked(listTrainingCompletions).mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    const data: HomeWeekContext = homeWeek();
    await data.init();
    expect(data.loading).toBe(false);
    expect(data.schedule).toBeNull();
    expect(data.showStart()).toBe(false);
    expect(data.showDone()).toBe(false);
  });
});
