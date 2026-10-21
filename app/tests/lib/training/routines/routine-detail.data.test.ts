// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@client/api/routines", () => ({
  getRoutine: vi.fn(),
  deleteRoutine: vi.fn(),
}));
vi.mock("@client/api/catalog", () => ({ fetchCatalogTags: vi.fn() }));
import { getRoutine, deleteRoutine } from "@client/api/routines";
import { fetchCatalogTags } from "@client/api/catalog";
import { routineDetail } from "@lib/training/routines/routine-detail.data";
import type { RoutineDetailContext } from "@lib/types";

const ROUTINE = {
  routineId: "o",
  routineName: "Mine",
  description: null,
  isSystemTemplate: false,
  steps: [
    {
      sequenceNumber: 1,
      exerciseTemplateId: "e",
      exerciseName: "Switching",
      exerciseDescription: "x",
      exerciseTypeKey: "SWITCHING",
      gameTypeKey: null,
      gameRulesetVersionKey: null,
      durationValue: 30,
      durationTypeKey: "MINUTES",
    },
  ],
};

const SET = {
  tags: [{ axis: "SKILL", key: "SCORING", name: "Scoring", primary: true }],
};
const TAGS = {
  games: { TUOD: { standalone: SET, routineStep: SET } },
  exercises: { SWITCHING: SET },
} as unknown as Awaited<ReturnType<typeof fetchCatalogTags>>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchCatalogTags).mockResolvedValue(TAGS);
  history.replaceState(null, "", "/training/routines/detail?routine=o");
});

describe("routineDetail", () => {
  it("loads the routine named in the URL and derives labels", async () => {
    vi.mocked(getRoutine).mockResolvedValue(ROUTINE);
    const data: RoutineDetailContext = routineDetail();
    await data.init();
    expect(getRoutine).toHaveBeenCalledWith("o");
    expect(data.routine).toEqual(ROUTINE);
    expect(data.durationLabel()).toBe("30 min");
    expect(data.stepDuration(ROUTINE.steps[0])).toBe("30 min");
    expect(data.playPath()).toBe("/training/routines/play?routine=o");
    expect(data.editPath()).toBe("/training/routines/edit?routine=o");
    expect(data.canEdit()).toBe(true);
  });

  it("start() sets starting=true and navigates to the routine's play path", async () => {
    vi.mocked(getRoutine).mockResolvedValue(ROUTINE);
    const data: RoutineDetailContext = routineDetail();
    await data.init();
    const original = globalThis.location;
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
    data.start();
    expect(data.starting).toBe(true);
    expect(globalThis.location.href).toBe("/training/routines/play?routine=o");
    Object.defineProperty(globalThis, "location", {
      value: original,
      configurable: true,
    });
  });

  it("cancelDelete() clears the deleting flag without deleting", async () => {
    vi.mocked(getRoutine).mockResolvedValue(ROUTINE);
    const data: RoutineDetailContext = routineDetail();
    await data.init();
    data.requestDelete();
    expect(data.deleting).toBe(true);
    data.cancelDelete();
    expect(data.deleting).toBe(false);
    expect(deleteRoutine).not.toHaveBeenCalled();
  });

  it("hides edit/delete for a system routine", async () => {
    vi.mocked(getRoutine).mockResolvedValue({
      ...ROUTINE,
      isSystemTemplate: true,
    });
    const data: RoutineDetailContext = routineDetail();
    await data.init();
    expect(data.canEdit()).toBe(false);
  });

  it("errors without a routine id", async () => {
    history.replaceState(null, "", "/training/routines/detail");
    const data: RoutineDetailContext = routineDetail();
    await data.init();
    expect(data.error).toContain("No routine");
    expect(getRoutine).not.toHaveBeenCalled();
  });

  it("confirmDelete deletes and navigates to /training", async () => {
    vi.mocked(getRoutine).mockResolvedValue(ROUTINE);
    vi.mocked(deleteRoutine).mockResolvedValue(undefined);
    const data: RoutineDetailContext = routineDetail();
    await data.init();
    const assign = vi.fn();
    data.navigate = assign;
    data.requestDelete();
    expect(data.deleting).toBe(true);
    await data.confirmDelete();
    expect(deleteRoutine).toHaveBeenCalledWith("o");
    expect(assign).toHaveBeenCalledWith("/training");
  });

  it("stepWeight uses minutes, else 1", () => {
    const data: RoutineDetailContext = routineDetail();
    expect(data.stepWeight(ROUTINE.steps[0])).toBe(30);
    expect(
      data.stepWeight({
        ...ROUTINE.steps[0],
        durationTypeKey: "ROUNDS",
        durationValue: 3,
      }),
    ).toBe(1);
  });

  it("stepTone cycles four tones", () => {
    const data: RoutineDetailContext = routineDetail();
    expect(data.stepTone(0, "bg")).toBe("bg-accent");
    expect(data.stepTone(3, "border")).toBe("border-white/35");
    expect(data.stepTone(4, "bg")).toBe("bg-accent");
  });

  it("totalMinutes is 0 with no steps", async () => {
    vi.mocked(getRoutine).mockResolvedValue({ ...ROUTINE, steps: [] });
    const data: RoutineDetailContext = routineDetail();
    await data.init();
    expect(data.totalMinutes()).toBe(0);
    expect(data.durationLabel()).toBe("0 min");
  });

  it("totalMinutes skips non-minute steps", async () => {
    vi.mocked(getRoutine).mockResolvedValue({
      ...ROUTINE,
      steps: [
        ROUTINE.steps[0],
        { ...ROUTINE.steps[0], durationTypeKey: "ROUNDS", durationValue: 3 },
      ],
    });
    const data: RoutineDetailContext = routineDetail();
    await data.init();
    expect(data.totalMinutes()).toBe(30);
  });

  it("stepTag reads the exercise set", async () => {
    vi.mocked(getRoutine).mockResolvedValue(ROUTINE);
    const data: RoutineDetailContext = routineDetail();
    await data.init();
    expect(data.stepTag(ROUTINE.steps[0])).toBe("Scoring");
  });

  it("stepTag reads a game step's routineStep set", async () => {
    vi.mocked(getRoutine).mockResolvedValue(ROUTINE);
    const data: RoutineDetailContext = routineDetail();
    await data.init();
    expect(
      data.stepTag({
        ...ROUTINE.steps[0],
        exerciseTypeKey: "GAME",
        gameTypeKey: "TUOD",
      }),
    ).toBe("Scoring");
  });

  it("stepTag null for a missing set", async () => {
    vi.mocked(getRoutine).mockResolvedValue(ROUTINE);
    const data: RoutineDetailContext = routineDetail();
    await data.init();
    expect(
      data.stepTag({ ...ROUTINE.steps[0], exerciseTypeKey: "NOPE" }),
    ).toBeNull();
  });

  it("loads the routine when the tags fetch rejects", async () => {
    vi.mocked(getRoutine).mockResolvedValue(ROUTINE);
    vi.mocked(fetchCatalogTags).mockRejectedValue(new Error("down"));
    const data: RoutineDetailContext = routineDetail();
    await data.init();
    expect(data.routine).toEqual(ROUTINE);
    expect(data.catalogTags).toBeNull();
    expect(data.error).toBe("");
    expect(data.stepTag(ROUTINE.steps[0])).toBeNull();
  });
});
