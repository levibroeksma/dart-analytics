// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("@client/api/schedules", () => ({
  getActiveSchedule: vi.fn(),
  createSchedule: vi.fn(),
  updateSchedule: vi.fn(),
  activateSchedule: vi.fn(),
}));
vi.mock("@client/api/routines", () => ({ listRoutines: vi.fn() }));
import {
  getActiveSchedule,
  createSchedule,
  updateSchedule,
  activateSchedule,
} from "@client/api/schedules";
import { listRoutines } from "@client/api/routines";
import { SessionApiError } from "@client/api/sessions";
import {
  myScheduleForm,
  MY_SCHEDULE_NAME,
} from "@lib/training/schedules/my-schedule.data";
import type { MyScheduleFormContext } from "@lib/types";

const ROUTINE = (routineId: string) => ({
  routineId,
  routineName: `Routine ${routineId}`,
  description: null,
  isSystemTemplate: true,
  stepCount: 1,
  totalMinutes: 30,
});
const ACTIVE = {
  scheduleId: "s1",
  name: "Mine",
  isActive: true,
  days: [
    { dayOfWeek: 3, routineId: "r2", routineName: "B", routineMinutes: 30 },
  ],
};

async function loaded(active: typeof ACTIVE | null = null) {
  vi.mocked(listRoutines).mockResolvedValue({
    items: [ROUTINE("r1"), ROUTINE("r2")],
    nextCursor: null,
  });
  vi.mocked(getActiveSchedule).mockResolvedValue(active);
  const data: MyScheduleFormContext = myScheduleForm();
  await data.init();
  return data;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe("myScheduleForm", () => {
  it("opens on today's weekday", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2024, 0, 3)); // Wednesday
    const data = await loaded();
    expect(data.selectedIndex).toBe(2);
    expect(data.selectedDayLabel()).not.toBe("");
  });

  it("loads the routine catalog and the active schedule's days", async () => {
    const data = await loaded(ACTIVE);
    expect(data.loading).toBe(false);
    expect(data.routines).toHaveLength(2);
    expect(data.scheduleId).toBe("s1");
    expect(data.name).toBe("Mine");
    expect(data.hasRoutine(2)).toBe(true);
    expect(data.hasRoutine(0)).toBe(false);
  });

  it("toggles a routine on and off for the selected day", async () => {
    const data = await loaded();
    data.selectDay(0);
    data.toggleRoutine(ROUTINE("r1"));
    expect(data.isRoutineSelected(ROUTINE("r1"))).toBe(true);
    expect(data.hasRoutine(0)).toBe(true);
    data.toggleRoutine(ROUTINE("r2"));
    expect(data.isRoutineSelected(ROUTINE("r1"))).toBe(false);
    expect(data.isRoutineSelected(ROUTINE("r2"))).toBe(true);
    data.toggleRoutine(ROUTINE("r2"));
    expect(data.hasRoutine(0)).toBe(false);
  });

  it("can only save once at least one day has a routine", async () => {
    const data = await loaded();
    expect(data.canSave()).toBe(false);
    data.selectDay(4);
    data.toggleRoutine(ROUTINE("r1"));
    expect(data.canSave()).toBe(true);
  });

  it("creates and activates a new schedule when none is active", async () => {
    const data = await loaded();
    data.selectDay(0);
    data.toggleRoutine(ROUTINE("r1"));
    const created = { ...ACTIVE, scheduleId: "s9", isActive: false };
    vi.mocked(createSchedule).mockResolvedValue(created);
    vi.mocked(activateSchedule).mockResolvedValue({
      ...created,
      isActive: true,
    });
    const listener = vi.fn();
    globalThis.addEventListener("schedule-saved", listener);
    expect(await data.save()).toBe(true);
    globalThis.removeEventListener("schedule-saved", listener);
    expect(createSchedule).toHaveBeenCalledWith({
      name: MY_SCHEDULE_NAME,
      days: [{ dayOfWeek: 1, routineTemplateId: "r1" }],
    });
    expect(activateSchedule).toHaveBeenCalledWith("s9");
    expect(data.scheduleId).toBe("s9");
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].detail).toMatchObject({
      scheduleId: "s9",
      isActive: true,
    });
  });

  it("updates the active schedule in place, keeping its name", async () => {
    const data = await loaded(ACTIVE);
    data.selectDay(0);
    data.toggleRoutine(ROUTINE("r1"));
    vi.mocked(updateSchedule).mockResolvedValue(ACTIVE);
    expect(await data.save()).toBe(true);
    expect(updateSchedule).toHaveBeenCalledWith("s1", {
      name: "Mine",
      days: [
        { dayOfWeek: 1, routineTemplateId: "r1" },
        { dayOfWeek: 3, routineTemplateId: "r2" },
      ],
    });
    expect(createSchedule).not.toHaveBeenCalled();
    expect(activateSchedule).not.toHaveBeenCalled();
  });

  it("does not save with every day on rest", async () => {
    const data = await loaded();
    expect(await data.save()).toBe(false);
    expect(createSchedule).not.toHaveBeenCalled();
  });

  it("surfaces a validation envelope as server issues", async () => {
    const data = await loaded();
    data.toggleRoutine(ROUTINE("r1"));
    vi.mocked(createSchedule).mockRejectedValue(
      new SessionApiError("VALIDATION_FAILED", "bad", "req", {
        reason: "unknown routineTemplateId",
        dayOfWeek: 1,
      }),
    );
    expect(await data.save()).toBe(false);
    expect(data.serverIssues).toEqual(["unknown routineTemplateId (day 1)"]);
    expect(data.saving).toBe(false);
  });

  it("reports a generic error when the save fails otherwise", async () => {
    const data = await loaded();
    data.toggleRoutine(ROUTINE("r1"));
    vi.mocked(createSchedule).mockRejectedValue(new Error("offline"));
    expect(await data.save()).toBe(false);
    expect(data.error).not.toBe("");
  });

  it("reports a load error when the catalog cannot be read", async () => {
    vi.mocked(listRoutines).mockRejectedValue(new Error("offline"));
    vi.mocked(getActiveSchedule).mockResolvedValue(null);
    const data: MyScheduleFormContext = myScheduleForm();
    await data.init();
    expect(data.error).not.toBe("");
    expect(data.loading).toBe(false);
    expect(data.canSave()).toBe(false);
  });

  it("resetForm reloads the saved state, discarding the draft", async () => {
    const data = await loaded(ACTIVE);
    data.selectDay(0);
    data.toggleRoutine(ROUTINE("r1"));
    await data.resetForm();
    expect(data.hasRoutine(0)).toBe(false);
    expect(data.hasRoutine(2)).toBe(true);
  });
});
