import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@db/client", () => ({
  getDb: vi.fn(() => ({})),
  withTransaction: vi.fn((fn: (tx: unknown) => unknown) => fn({ tx: true })),
}));
vi.mock("@lib/id", () => {
  let n = 0;
  return { generateId: vi.fn(() => `id-${++n}`) };
});
vi.mock("@repositories/schedule.repository", () => ({
  findScheduleRows: vi.fn(),
  findScheduleDayRows: vi.fn(),
  insertScheduleRecord: vi.fn(),
  updateScheduleRecord: vi.fn(),
  replaceScheduleDayRecords: vi.fn(),
  setActiveSchedule: vi.fn(),
  clearActiveSchedule: vi.fn(),
  deleteScheduleRecord: vi.fn(),
}));
vi.mock("@services/routine.service", () => ({
  getRoutine: vi.fn(),
}));

import * as repo from "@repositories/schedule.repository";
import { getRoutine } from "@services/routine.service";
import { withTransaction } from "@db/client";
import {
  listSchedules,
  getSchedule,
  getActiveSchedule,
  createSchedule,
  replaceSchedule,
  activateSchedule,
  deactivateSchedule,
  deleteSchedule,
} from "@services/schedule.service";

function scheduleRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    scheduleId: "sch-1",
    playerId: "p1",
    name: "Mine",
    isActive: false,
    updatedAt: "2026-09-01T00:00:00.000Z",
    dayCount: 1,
    ...over,
  };
}

function dayRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    scheduleId: "sch-1",
    playerId: "p1",
    scheduleName: "Mine",
    isActive: false,
    dayOfWeek: 1,
    routineTemplateId: "rt-1",
    routineName: "Routine",
    routineMinutes: 30,
    ...over,
  };
}

const VALID_INPUT = {
  name: "  Mine  ",
  days: [
    { dayOfWeek: 1, routineTemplateId: "rt-1" },
    { dayOfWeek: 3, routineTemplateId: "rt-2" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRoutine).mockResolvedValue({
    ok: true,
    data: {
      routineId: "rt-1",
      routineName: "Routine",
      description: null,
      isSystemTemplate: false,
      steps: [],
    },
  });
});

describe("listSchedules", () => {
  it("maps view rows into summaries", async () => {
    vi.mocked(repo.findScheduleRows).mockResolvedValue([scheduleRow()]);
    const result = await listSchedules("p1");
    expect(result).toEqual({
      ok: true,
      data: {
        items: [
          { scheduleId: "sch-1", name: "Mine", isActive: false, dayCount: 1 },
        ],
        nextCursor: null,
      },
    });
    expect(repo.findScheduleRows).toHaveBeenCalledWith(expect.anything(), "p1");
  });
});

describe("getSchedule", () => {
  it("returns NOT_FOUND when the view has no row for (player, schedule)", async () => {
    vi.mocked(repo.findScheduleRows).mockResolvedValue([]);
    expect(await getSchedule("p1", "sch-x")).toEqual({
      ok: false,
      code: "NOT_FOUND",
      details: { scheduleId: "sch-x" },
    });
  });

  it("returns the schedule with its days sorted by dayOfWeek", async () => {
    vi.mocked(repo.findScheduleRows).mockResolvedValue([scheduleRow()]);
    vi.mocked(repo.findScheduleDayRows).mockResolvedValue([
      dayRow({ dayOfWeek: 3, routineTemplateId: "rt-2", routineName: "B" }),
      dayRow({ dayOfWeek: 1, routineTemplateId: "rt-1", routineName: "A" }),
    ]);
    const result = await getSchedule("p1", "sch-1");
    expect(result).toEqual({
      ok: true,
      data: {
        scheduleId: "sch-1",
        name: "Mine",
        isActive: false,
        days: [
          {
            dayOfWeek: 1,
            routineId: "rt-1",
            routineName: "A",
            routineMinutes: 30,
          },
          {
            dayOfWeek: 3,
            routineId: "rt-2",
            routineName: "B",
            routineMinutes: 30,
          },
        ],
      },
    });
  });
});

describe("getActiveSchedule", () => {
  it("returns null when none active", async () => {
    vi.mocked(repo.findScheduleRows).mockResolvedValue([
      scheduleRow({ isActive: false }),
    ]);
    expect(await getActiveSchedule("p1")).toEqual({ ok: true, data: null });
    expect(repo.findScheduleDayRows).not.toHaveBeenCalled();
  });

  it("returns the active schedule", async () => {
    vi.mocked(repo.findScheduleRows).mockResolvedValue([
      scheduleRow({ scheduleId: "sch-1", isActive: true }),
    ]);
    vi.mocked(repo.findScheduleDayRows).mockResolvedValue([dayRow()]);
    const result = await getActiveSchedule("p1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.scheduleId).toBe("sch-1");
    expect(result.data?.isActive).toBe(true);
  });
});

describe("createSchedule", () => {
  it("rejects a duplicate dayOfWeek in the input", async () => {
    const result = await createSchedule("p1", {
      name: "Mine",
      days: [
        { dayOfWeek: 1, routineTemplateId: "rt-1" },
        { dayOfWeek: 1, routineTemplateId: "rt-2" },
      ],
    });
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "duplicate dayOfWeek", dayOfWeek: 1 },
    });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("rejects an unknown routineTemplateId with the dayOfWeek", async () => {
    vi.mocked(getRoutine).mockResolvedValueOnce({
      ok: false,
      code: "NOT_FOUND",
      details: { routineId: "rt-1" },
    });
    const result = await createSchedule("p1", VALID_INPUT);
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown routineTemplateId", dayOfWeek: 1 },
    });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("inserts schedule then days inside one transaction and reads the schedule back", async () => {
    vi.mocked(repo.findScheduleRows).mockResolvedValue([
      scheduleRow({ scheduleId: "id-1" }),
    ]);
    vi.mocked(repo.findScheduleDayRows).mockResolvedValue([]);
    const result = await createSchedule("p1", VALID_INPUT);
    expect(result.ok).toBe(true);
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(repo.insertScheduleRecord).toHaveBeenCalledWith(
      { tx: true },
      { scheduleId: "id-1", playerId: "p1", name: "Mine" },
    );
    expect(repo.replaceScheduleDayRecords).toHaveBeenCalledWith(
      { tx: true },
      expect.objectContaining({
        scheduleId: "id-1",
        days: [
          { id: "id-2", dayOfWeek: 1, routineTemplateId: "rt-1" },
          { id: "id-3", dayOfWeek: 3, routineTemplateId: "rt-2" },
        ],
      }),
    );
    expect(repo.findScheduleRows).toHaveBeenCalledWith(
      expect.anything(),
      "p1",
      "id-1",
    );
    const order = [
      vi.mocked(repo.insertScheduleRecord).mock.invocationCallOrder[0],
      vi.mocked(repo.replaceScheduleDayRecords).mock.invocationCallOrder[0],
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe("replaceSchedule", () => {
  it("returns NOT_FOUND when the view has no row for (player, schedule)", async () => {
    vi.mocked(repo.findScheduleRows).mockResolvedValue([]);
    expect(await replaceSchedule("p1", "sch-x", VALID_INPUT)).toEqual({
      ok: false,
      code: "NOT_FOUND",
      details: { scheduleId: "sch-x" },
    });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("updates then delete/inserts days inside one transaction", async () => {
    vi.mocked(repo.findScheduleRows).mockResolvedValue([
      scheduleRow({ scheduleId: "sch-1" }),
    ]);
    vi.mocked(repo.findScheduleDayRows).mockResolvedValue([]);
    const result = await replaceSchedule("p1", "sch-1", VALID_INPUT);
    expect(result.ok).toBe(true);
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(repo.updateScheduleRecord).toHaveBeenCalledWith(
      { tx: true },
      { scheduleId: "sch-1", playerId: "p1", name: "Mine" },
    );
    expect(repo.replaceScheduleDayRecords).toHaveBeenCalledWith(
      { tx: true },
      expect.objectContaining({ scheduleId: "sch-1" }),
    );
  });
});

describe("activateSchedule", () => {
  it("returns NOT_FOUND when nothing matched", async () => {
    vi.mocked(repo.setActiveSchedule).mockResolvedValue(false);
    expect(await activateSchedule("p1", "sch-x")).toEqual({
      ok: false,
      code: "NOT_FOUND",
      details: { scheduleId: "sch-x" },
    });
  });

  it("activates inside one transaction and returns the schedule with isActive true", async () => {
    vi.mocked(repo.setActiveSchedule).mockResolvedValue(true);
    vi.mocked(repo.findScheduleRows).mockResolvedValue([
      scheduleRow({ scheduleId: "sch-1", isActive: true }),
    ]);
    vi.mocked(repo.findScheduleDayRows).mockResolvedValue([]);
    const result = await activateSchedule("p1", "sch-1");
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(repo.setActiveSchedule).toHaveBeenCalledWith(
      { tx: true },
      { playerId: "p1", scheduleId: "sch-1" },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.isActive).toBe(true);
  });
});

describe("deactivateSchedule", () => {
  it("returns NOT_FOUND when nothing matched", async () => {
    vi.mocked(repo.clearActiveSchedule).mockResolvedValue(false);
    expect(await deactivateSchedule("p1", "sch-x")).toEqual({
      ok: false,
      code: "NOT_FOUND",
      details: { scheduleId: "sch-x" },
    });
  });

  it("deactivates and returns the schedule with isActive false", async () => {
    vi.mocked(repo.clearActiveSchedule).mockResolvedValue(true);
    vi.mocked(repo.findScheduleRows).mockResolvedValue([
      scheduleRow({ scheduleId: "sch-1", isActive: false }),
    ]);
    vi.mocked(repo.findScheduleDayRows).mockResolvedValue([]);
    const result = await deactivateSchedule("p1", "sch-1");
    expect(repo.clearActiveSchedule).toHaveBeenCalledWith(expect.anything(), {
      playerId: "p1",
      scheduleId: "sch-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.isActive).toBe(false);
  });
});

describe("deleteSchedule", () => {
  it("returns NOT_FOUND when nothing matched", async () => {
    vi.mocked(repo.deleteScheduleRecord).mockResolvedValue(false);
    expect(await deleteSchedule("p1", "sch-x")).toEqual({
      ok: false,
      code: "NOT_FOUND",
      details: { scheduleId: "sch-x" },
    });
  });

  it("deletes an existing schedule", async () => {
    vi.mocked(repo.deleteScheduleRecord).mockResolvedValue(true);
    expect(await deleteSchedule("p1", "sch-1")).toEqual({
      ok: true,
      data: null,
    });
    expect(repo.deleteScheduleRecord).toHaveBeenCalledWith(
      expect.anything(),
      "sch-1",
      "p1",
    );
  });
});
