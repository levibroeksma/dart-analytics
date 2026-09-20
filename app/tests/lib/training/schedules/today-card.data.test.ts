// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("@client/api/schedules", () => ({ getActiveSchedule: vi.fn() }));
import { getActiveSchedule } from "@client/api/schedules";
import { todayCard } from "@lib/training/schedules/today-card.data";
import type { TodayCardContext } from "@lib/types";

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
  ],
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe("todayCard", () => {
  it("loads the active schedule", async () => {
    vi.mocked(getActiveSchedule).mockResolvedValue(SCHEDULE);
    const data: TodayCardContext = todayCard();
    await data.init();
    expect(data.loading).toBe(false);
    expect(data.schedule).toEqual(SCHEDULE);
  });

  it("has no schedule when none is active", async () => {
    vi.mocked(getActiveSchedule).mockResolvedValue(null);
    const data: TodayCardContext = todayCard();
    await data.init();
    expect(data.schedule).toBeNull();
  });

  it("resolves today's routine and its play path on a training day", async () => {
    vi.mocked(getActiveSchedule).mockResolvedValue(SCHEDULE);
    const data: TodayCardContext = todayCard();
    await data.init();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1)); // Monday
    expect(data.isRestDay()).toBe(false);
    expect(data.startPath()).toBe("/training/routines/play?routine=r1");
  });

  it("is a rest day when today has no mapped routine", async () => {
    vi.mocked(getActiveSchedule).mockResolvedValue(SCHEDULE);
    const data: TodayCardContext = todayCard();
    await data.init();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 2)); // Tuesday
    expect(data.isRestDay()).toBe(true);
    expect(data.startPath()).toBe("/training");
  });

  it("navigates to the resolved start path", async () => {
    vi.mocked(getActiveSchedule).mockResolvedValue(SCHEDULE);
    const data: TodayCardContext = todayCard();
    await data.init();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1)); // Monday
    const nav = vi.fn();
    data.navigate = nav;
    data.start();
    expect(nav).toHaveBeenCalledWith("/training/routines/play?routine=r1");
  });

  it("surfaces a load failure as error text", async () => {
    vi.mocked(getActiveSchedule).mockRejectedValue(new Error("boom"));
    const data: TodayCardContext = todayCard();
    await data.init();
    expect(data.error).toContain("Could not load");
  });
});
