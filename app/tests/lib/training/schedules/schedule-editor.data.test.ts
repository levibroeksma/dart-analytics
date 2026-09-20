// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@client/api/routines", () => ({ listRoutines: vi.fn() }));
vi.mock("@client/api/schedules", () => ({
  getSchedule: vi.fn(),
  createSchedule: vi.fn(),
  updateSchedule: vi.fn(),
}));
import * as routinesApi from "@client/api/routines";
import * as schedulesApi from "@client/api/schedules";
import { SessionApiError } from "@client/api/sessions";
import { scheduleEditor } from "@lib/training/schedules/schedule-editor.data";
import type { ScheduleEditorContext } from "@lib/types";

const ROUTINES = {
  items: [
    {
      routineId: "r1",
      routineName: "Warm-Up",
      description: null,
      isSystemTemplate: true,
      stepCount: 2,
      totalMinutes: 30,
    },
    {
      routineId: "r2",
      routineName: "Mine",
      description: null,
      isSystemTemplate: false,
      stepCount: 1,
      totalMinutes: 45,
    },
  ],
  nextCursor: null,
};

const SCHEDULE = {
  scheduleId: "s1",
  name: "Week",
  isActive: false,
  days: [
    {
      dayOfWeek: 1,
      routineId: "r1",
      routineName: "Warm-Up",
      routineMinutes: 30,
    },
    { dayOfWeek: 5, routineId: "r2", routineName: "Mine", routineMinutes: 45 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(routinesApi.listRoutines).mockResolvedValue(ROUTINES);
});

describe("scheduleEditor (create)", () => {
  it("loads the routine catalog and starts with seven rest rows", async () => {
    const e: ScheduleEditorContext = scheduleEditor("create");
    await e.init();
    expect(e.routines).toEqual(ROUTINES.items);
    expect(e.rows).toHaveLength(7);
    expect(e.rows.map((r) => r.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(e.rows.every((r) => r.routineTemplateId === null)).toBe(true);
    expect(e.canSave()).toBe(false);
  });

  it("labels a routine option with its total minutes", async () => {
    const e: ScheduleEditorContext = scheduleEditor("create");
    await e.init();
    expect(e.routineLabel(ROUTINES.items[1])).toBe("Mine (45 min)");
  });

  it("labels each row's weekday Monday..Sunday by row index", async () => {
    const e: ScheduleEditorContext = scheduleEditor("create");
    await e.init();
    expect(e.weekdayLabel(0)).toBe("Monday");
    expect(e.weekdayLabel(6)).toBe("Sunday");
  });

  it("requires a name and POSTs only the mapped (non-rest) days", async () => {
    vi.mocked(schedulesApi.createSchedule).mockResolvedValue({
      ...SCHEDULE,
      scheduleId: "new",
    });
    const e: ScheduleEditorContext = scheduleEditor("create");
    await e.init();
    expect(e.canSave()).toBe(false);
    e.name = "Week";
    expect(e.canSave()).toBe(true);
    e.rows[0].routineTemplateId = "r1";
    e.rows[4].routineTemplateId = "r2";
    const nav = vi.fn();
    e.navigate = nav;
    await e.save();
    expect(schedulesApi.createSchedule).toHaveBeenCalledWith({
      name: "Week",
      days: [
        { dayOfWeek: 1, routineTemplateId: "r1" },
        { dayOfWeek: 5, routineTemplateId: "r2" },
      ],
    });
    expect(nav).toHaveBeenCalledWith("/training/schedules");
  });

  it("treats a row reset to the native select's empty-string Rest value as rest, not a real id", async () => {
    vi.mocked(schedulesApi.createSchedule).mockResolvedValue({
      ...SCHEDULE,
      scheduleId: "new",
    });
    const e: ScheduleEditorContext = scheduleEditor("create");
    await e.init();
    e.name = "Week";
    e.rows[0].routineTemplateId = "r1";
    e.rows[0].routineTemplateId = ""; // the <select>'s "Rest" option value
    await e.save();
    expect(schedulesApi.createSchedule).toHaveBeenCalledWith({
      name: "Week",
      days: [],
    });
  });

  it("shows the envelope's issues on VALIDATION_FAILED", async () => {
    vi.mocked(schedulesApi.createSchedule).mockRejectedValue(
      new SessionApiError("VALIDATION_FAILED", "bad", "r", {
        reason: "duplicate dayOfWeek",
      }),
    );
    const e: ScheduleEditorContext = scheduleEditor("create");
    await e.init();
    e.name = "Week";
    await e.save();
    expect(e.serverIssues).toEqual(["duplicate dayOfWeek"]);
    expect(e.saving).toBe(false);
  });

  it("names the offending weekday when the server reports it", async () => {
    vi.mocked(schedulesApi.createSchedule).mockRejectedValue(
      new SessionApiError("VALIDATION_FAILED", "bad", "r", {
        reason: "unknown routineTemplateId",
        dayOfWeek: 3,
      }),
    );
    const e: ScheduleEditorContext = scheduleEditor("create");
    await e.init();
    e.name = "Week";
    await e.save();
    expect(e.serverIssues).toEqual(["unknown routineTemplateId (day 3)"]);
  });

  it("a failed save clears on retry instead of permanently disabling Save", async () => {
    vi.mocked(schedulesApi.createSchedule).mockRejectedValueOnce(
      new Error("network blip"),
    );
    const e: ScheduleEditorContext = scheduleEditor("create");
    await e.init();
    e.name = "Week";
    await e.save();
    expect(e.error).toContain("Could not save");
    expect(e.canSave()).toBe(true);

    vi.mocked(schedulesApi.createSchedule).mockResolvedValue({
      ...SCHEDULE,
      scheduleId: "new",
    });
    const nav = vi.fn();
    e.navigate = nav;
    await e.save();
    expect(e.error).toBe("");
    expect(nav).toHaveBeenCalledWith("/training/schedules");
  });
});

describe("scheduleEditor (edit)", () => {
  beforeEach(() =>
    history.replaceState(null, "", "/training/schedules/edit?schedule=s1"),
  );

  it("loads the schedule into rows and PUTs on save", async () => {
    vi.mocked(schedulesApi.getSchedule).mockResolvedValue(SCHEDULE);
    vi.mocked(schedulesApi.updateSchedule).mockResolvedValue(SCHEDULE);
    const e: ScheduleEditorContext = scheduleEditor("edit");
    await e.init();
    expect(e.name).toBe("Week");
    expect(e.rows[0].routineTemplateId).toBe("r1");
    expect(e.rows[4].routineTemplateId).toBe("r2");
    expect(e.rows[1].routineTemplateId).toBeNull();
    const nav = vi.fn();
    e.navigate = nav;
    await e.save();
    expect(schedulesApi.updateSchedule).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ name: "Week" }),
    );
    expect(nav).toHaveBeenCalledWith("/training/schedules");
  });

  it("reports a schedule-specific error when loading fails", async () => {
    vi.mocked(schedulesApi.getSchedule).mockRejectedValue(new Error("network"));
    const e: ScheduleEditorContext = scheduleEditor("edit");
    await e.init();
    expect(e.error).toBe("Could not load this schedule.");
    expect(e.routines).toEqual(ROUTINES.items);
  });
});
