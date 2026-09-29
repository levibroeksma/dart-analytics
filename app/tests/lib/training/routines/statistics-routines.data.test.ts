// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchTrainedRoutines = vi.fn();
const fetchRoutineHeader = vi.fn();
const listRoutines = vi.fn();

vi.mock("@client/api/routines", () => ({
  listRoutines: (...args: unknown[]) => listRoutines(...args),
}));
vi.mock("@client/api/statistics", () => ({
  fetchGameSection: vi.fn(),
  fetchGameSessions: vi.fn(),
  fetchTrainedRoutines: (...args: unknown[]) => fetchTrainedRoutines(...args),
  fetchRoutineHeader: (...args: unknown[]) => fetchRoutineHeader(...args),
  fetchRoutineSection: vi.fn(),
  fetchRoutineStepSection: vi.fn(),
  fetchRoutineStepSessions: vi.fn(),
}));
vi.mock("@client/stats-cache/cache", () => ({
  readSection: vi.fn(),
  readSessionPage: vi.fn(),
  noteDataVersion: vi.fn(),
}));

const { statisticsRoutines } =
  await import("@lib/training/routines/statistics-routines.data");
const { routineStatsStore } = await import("@stores/routine-stats.store");

const RECENT = {
  routineKey: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
  routineTemplateId: "0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
  routineName: "Balanced Training",
  runCount: 4,
  completedRunCount: 3,
  lastRunAt: "2026-02-01T00:00:00.000Z",
};
const OLDER = {
  routineKey: "name-0123456789abcdef0123456789abcdef",
  routineTemplateId: null,
  routineName: "Mine",
  runCount: 1,
  completedRunCount: 1,
  lastRunAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchRoutineHeader.mockRejectedValue(new Error("header not under test"));
});

/** The picker as Alpine mounts it: the data factory with its `$store` magic bound to a live `routineStats` store. */
async function mountPicker(items: unknown[]) {
  fetchTrainedRoutines.mockResolvedValue({ items });
  const store = routineStatsStore();
  await store.init();
  const data = Object.assign(statisticsRoutines(), {
    $store: { routineStats: store },
  });
  return { data, store };
}

describe("statisticsRoutines", () => {
  it("seeds the picker with the first trained routine, in the order the list arrives", async () => {
    const { data } = await mountPicker([RECENT, OLDER]);

    expect(data.routineOptions()).toEqual([
      { value: RECENT.routineKey, label: "Balanced Training" },
      { value: OLDER.routineKey, label: "Mine" },
    ]);
    expect(data.routine).toBe(data.routineOptions()[0]?.value);
  });

  it("lists trained routines, never the GET /api/routines catalogue", async () => {
    await mountPicker([RECENT]);

    expect(fetchTrainedRoutines).toHaveBeenCalledTimes(1);
    expect(listRoutines).not.toHaveBeenCalled();
  });

  it("selects a picked routine through the store", async () => {
    const { data, store } = await mountPicker([RECENT, OLDER]);
    const selectRoutine = vi.spyOn(store, "selectRoutine");

    data.routine = OLDER.routineKey;

    expect(selectRoutine).toHaveBeenCalledWith(OLDER.routineKey);
  });

  it("does not reload when the already-selected routine is picked again", async () => {
    const { data, store } = await mountPicker([RECENT, OLDER]);
    const selectRoutine = vi.spyOn(store, "selectRoutine");

    data.routine = RECENT.routineKey;

    expect(selectRoutine).not.toHaveBeenCalled();
  });

  it("selects nothing when no routine was ever trained", async () => {
    const { data } = await mountPicker([]);

    expect(data.routineOptions()).toEqual([]);
    expect(data.routine).toBe("");
  });
});
