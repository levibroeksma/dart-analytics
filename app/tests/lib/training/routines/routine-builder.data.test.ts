// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@client/api/routines", () => ({
  listExerciseTemplates: vi.fn(),
  getRoutine: vi.fn(),
  createRoutine: vi.fn(),
  updateRoutine: vi.fn(),
}));
import * as api from "@client/api/routines";
import { SessionApiError } from "@client/api/sessions";
import { routineBuilder } from "@lib/training/routines/routine-builder.data";
import type { RoutineBuilderContext } from "@lib/types";

const CATALOG = [
  {
    exerciseTemplateId: "et-w",
    name: "Warm-Up",
    description: "d",
    exerciseTypeKey: "WARM_UP",
    gameTypeKey: null,
  },
  {
    exerciseTemplateId: "et-f",
    name: "Finishing",
    description: "d",
    exerciseTypeKey: "GAME",
    gameTypeKey: "TUOD",
  },
];
const ROUTINE = {
  routineId: "o",
  routineName: "Mine",
  description: "desc",
  isSystemTemplate: false,
  steps: [
    {
      sequenceNumber: 1,
      exerciseTemplateId: "et-w",
      exerciseName: "Warm-Up",
      exerciseDescription: "d",
      exerciseTypeKey: "WARM_UP",
      gameTypeKey: null,
      durationValue: 20,
      durationTypeKey: "MINUTES",
    },
    {
      sequenceNumber: 2,
      exerciseTemplateId: "et-f",
      exerciseName: "Finishing",
      exerciseDescription: "d",
      exerciseTypeKey: "GAME",
      gameTypeKey: "TUOD",
      durationValue: 10,
      durationTypeKey: "MINUTES",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listExerciseTemplates).mockResolvedValue(CATALOG);
});

describe("routineBuilder (create)", () => {
  it("loads the catalog and starts empty and unsavable", async () => {
    const b: RoutineBuilderContext = routineBuilder("create");
    await b.init();
    expect(b.catalog).toEqual(CATALOG);
    expect(b.steps).toEqual([]);
    expect(b.totalMinutes()).toBe(0);
    expect(b.canSave()).toBe(false);
  });

  it("adds a step with the 5-minute default and tracks the total", async () => {
    const b: RoutineBuilderContext = routineBuilder("create");
    await b.init();
    b.addStep(CATALOG[0]);
    expect(b.steps).toEqual([
      {
        exerciseTemplateId: "et-w",
        name: "Warm-Up",
        exerciseTypeKey: "WARM_UP",
        durationValue: 5,
      },
    ]);
    b.setMinutes(0, 30);
    expect(b.totalMinutes()).toBe(30);
    b.name = "Mine";
    expect(b.canSave()).toBe(true);
  });

  it("moves and removes steps", async () => {
    const b: RoutineBuilderContext = routineBuilder("create");
    await b.init();
    b.addStep(CATALOG[0]);
    b.addStep(CATALOG[1]);
    b.moveDown(0);
    expect(b.steps.map((s) => s.exerciseTemplateId)).toEqual(["et-f", "et-w"]);
    b.moveUp(1);
    expect(b.steps.map((s) => s.exerciseTemplateId)).toEqual(["et-w", "et-f"]);
    b.moveUp(0);
    expect(b.steps.map((s) => s.exerciseTemplateId)).toEqual(["et-w", "et-f"]);
    b.removeStep(0);
    expect(b.steps.map((s) => s.exerciseTemplateId)).toEqual(["et-f"]);
  });

  it("caps at 12 steps and clamps minutes to 1..60", async () => {
    const b: RoutineBuilderContext = routineBuilder("create");
    await b.init();
    for (let i = 0; i < 13; i++) b.addStep(CATALOG[0]);
    expect(b.steps).toHaveLength(12);
    b.setMinutes(0, 0);
    expect(b.steps[0].durationValue).toBe(1);
    b.setMinutes(0, 99);
    expect(b.steps[0].durationValue).toBe(60);
    b.setMinutes(0, 7.9);
    expect(b.steps[0].durationValue).toBe(7);
  });

  it("names the rule when the total is outside 30..60", async () => {
    const b: RoutineBuilderContext = routineBuilder("create");
    await b.init();
    b.addStep(CATALOG[0]);
    b.setMinutes(0, 10);
    b.name = "Mine";
    expect(b.canSave()).toBe(false);
    expect(b.durationIssues().join(" ")).toContain("minimum is 30");
  });

  it("POSTs on save and navigates to the new detail page", async () => {
    vi.mocked(api.createRoutine).mockResolvedValue({
      ...ROUTINE,
      routineId: "new",
    });
    const b: RoutineBuilderContext = routineBuilder("create");
    await b.init();
    b.name = "Mine";
    b.description = "";
    b.addStep(CATALOG[0]);
    b.setMinutes(0, 30);
    const nav = vi.fn();
    b.navigate = nav;
    await b.save();
    expect(api.createRoutine).toHaveBeenCalledWith({
      name: "Mine",
      description: null,
      steps: [
        {
          exerciseTemplateId: "et-w",
          durationTypeKey: "MINUTES",
          durationValue: 30,
        },
      ],
    });
    expect(nav).toHaveBeenCalledWith("/training/routines/detail?routine=new");
  });

  it("shows the envelope's issues on VALIDATION_FAILED", async () => {
    vi.mocked(api.createRoutine).mockRejectedValue(
      new SessionApiError("VALIDATION_FAILED", "bad", "r", {
        issues: ["routine is 20 minutes; the minimum is 30"],
      }),
    );
    const b: RoutineBuilderContext = routineBuilder("create");
    await b.init();
    b.name = "Mine";
    b.addStep(CATALOG[0]);
    b.setMinutes(0, 30);
    await b.save();
    expect(b.serverIssues).toEqual([
      "routine is 20 minutes; the minimum is 30",
    ]);
    expect(b.saving).toBe(false);
  });
});

describe("routineBuilder (edit)", () => {
  beforeEach(() =>
    history.replaceState(null, "", "/training/routines/edit?routine=o"),
  );

  it("loads the routine into state and PUTs on save", async () => {
    vi.mocked(api.getRoutine).mockResolvedValue(ROUTINE);
    vi.mocked(api.updateRoutine).mockResolvedValue(ROUTINE);
    const b: RoutineBuilderContext = routineBuilder("edit");
    await b.init();
    expect(b.name).toBe("Mine");
    expect(b.description).toBe("desc");
    expect(b.steps.map((s) => [s.exerciseTemplateId, s.durationValue])).toEqual(
      [
        ["et-w", 20],
        ["et-f", 10],
      ],
    );
    expect(b.totalMinutes()).toBe(30);
    const nav = vi.fn();
    b.navigate = nav;
    await b.save();
    expect(api.updateRoutine).toHaveBeenCalledWith(
      "o",
      expect.objectContaining({ name: "Mine", description: "desc" }),
    );
    expect(nav).toHaveBeenCalledWith("/training/routines/detail?routine=o");
  });

  it("refuses to edit a system routine", async () => {
    vi.mocked(api.getRoutine).mockResolvedValue({
      ...ROUTINE,
      isSystemTemplate: true,
    });
    const b: RoutineBuilderContext = routineBuilder("edit");
    await b.init();
    expect(b.error).toContain("cannot be edited");
    expect(b.canSave()).toBe(false);
  });
});
