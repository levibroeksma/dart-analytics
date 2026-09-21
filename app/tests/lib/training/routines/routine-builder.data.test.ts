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
import * as builderModule from "@lib/training/routines/routine-builder.data";
import { routineBuilder } from "@lib/training/routines/routine-builder.data";
import type { RoutineBuilderContext } from "@lib/types";

const CATALOG = [
  {
    exerciseTemplateId: "et-w",
    name: "Warm-Up",
    description: "d",
    exerciseTypeKey: "WARM_UP",
    gameTypeKey: null,
    gameRulesetVersionKey: null,
  },
  {
    exerciseTemplateId: "et-f",
    name: "Finishing",
    description: "d",
    exerciseTypeKey: "GAME",
    gameTypeKey: "TUOD",
    gameRulesetVersionKey: "TUOD_V1",
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
      gameRulesetVersionKey: null,
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
      gameRulesetVersionKey: "TUOD_V1",
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

  it("exports only the factory -- the caps reach Alpine as context fields, never as module exports", () => {
    // MAX_BUILDER_STEPS/DEFAULT_STEP_MINUTES are module-local on purpose: the
    // `.astro` templates read `maxSteps` off the reactive context (the module
    // is browser-only and cannot be imported from frontmatter), so an export
    // here has no consumer and fails `npx fallow`'s stale-usage gate.
    expect(Object.keys(builderModule)).toEqual(["routineBuilder"]);
  });

  it("publishes the step-count and minute bounds as reactive context fields", async () => {
    const b: RoutineBuilderContext = routineBuilder("create");
    await b.init();
    expect(b.maxSteps).toBe(12);
    expect(b.stepMinMinutes).toBe(1);
    expect(b.stepMaxMinutes).toBe(60);
    expect(b.maxNameLength).toBe(60);
  });

  it("adds a step with the 5-minute default and tracks the total", async () => {
    const b: RoutineBuilderContext = routineBuilder("create");
    await b.init();
    b.addStep(CATALOG[0]);
    expect(b.steps).toEqual([
      {
        key: expect.any(String),
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
    const [first, second] = b.steps.map((s) => s.key);
    b.moveStep(first!, 1);
    expect(b.steps.map((s) => s.exerciseTemplateId)).toEqual(["et-f", "et-w"]);
    b.moveStep(first!, 0);
    expect(b.steps.map((s) => s.exerciseTemplateId)).toEqual(["et-w", "et-f"]);
    b.moveStep(second!, 5);
    expect(b.steps.map((s) => s.exerciseTemplateId)).toEqual(["et-w", "et-f"]);
    b.moveStep("no-such-key", 0);
    expect(b.steps.map((s) => s.exerciseTemplateId)).toEqual(["et-w", "et-f"]);
    b.removeStep(0);
    expect(b.steps.map((s) => s.exerciseTemplateId)).toEqual(["et-f"]);
  });

  it("gives every step a distinct key, so duplicates of one exercise reorder independently", async () => {
    const b: RoutineBuilderContext = routineBuilder("create");
    await b.init();
    b.addStep(CATALOG[0]);
    b.addStep(CATALOG[0]);
    const keys = b.steps.map((s) => s.key);
    expect(new Set(keys).size).toBe(2);
    b.setMinutes(1, 9);
    b.moveStep(keys[1]!, 0);
    expect(b.steps.map((s) => s.durationValue)).toEqual([9, 5]);
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

  it("pre-checks a GAME step's 3..30 minute bound and blocks save outside it", async () => {
    const b: RoutineBuilderContext = routineBuilder("create");
    await b.init();
    b.addStep(CATALOG[1]);
    b.setMinutes(0, 40);
    b.name = "Mine";
    expect(b.canSave()).toBe(false);
    expect(b.durationIssues().join(" ")).toContain("between 3 and 30 minutes");
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

  it("formats a GAME-bound VALIDATION_FAILED envelope's step/min/max instead of a bare reason", async () => {
    vi.mocked(api.createRoutine).mockRejectedValue(
      new SessionApiError("VALIDATION_FAILED", "bad", "r", {
        reason: "game step minutes out of bounds",
        step: 2,
        min: 3,
        max: 30,
      }),
    );
    const b: RoutineBuilderContext = routineBuilder("create");
    await b.init();
    b.name = "Mine";
    b.addStep(CATALOG[0]);
    b.setMinutes(0, 30);
    await b.save();
    expect(b.serverIssues).toEqual([
      "game step minutes out of bounds (step 2, allowed 3–30 minutes)",
    ]);
  });

  it("a failed save clears on retry instead of permanently disabling Save", async () => {
    vi.mocked(api.createRoutine).mockRejectedValueOnce(
      new Error("network blip"),
    );
    const b: RoutineBuilderContext = routineBuilder("create");
    await b.init();
    b.name = "Mine";
    b.addStep(CATALOG[0]);
    b.setMinutes(0, 30);
    await b.save();
    expect(b.error).toContain("Could not save");
    expect(b.canSave()).toBe(true);

    vi.mocked(api.createRoutine).mockResolvedValue({
      ...ROUTINE,
      routineId: "new",
    });
    const nav = vi.fn();
    b.navigate = nav;
    await b.save();
    expect(b.error).toBe("");
    expect(nav).toHaveBeenCalledWith("/training/routines/detail?routine=new");
  });

  it("clears stale server issues as soon as the user edits a step", async () => {
    vi.mocked(api.createRoutine).mockRejectedValue(
      new SessionApiError("VALIDATION_FAILED", "bad", "r", {
        issues: ["stale"],
      }),
    );
    const b: RoutineBuilderContext = routineBuilder("create");
    await b.init();
    b.name = "Mine";
    b.addStep(CATALOG[0]);
    b.setMinutes(0, 30);
    await b.save();
    expect(b.serverIssues).toEqual(["stale"]);
    b.setMinutes(0, 35);
    expect(b.serverIssues).toEqual([]);
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

  it("reports a routine-specific error, not the catalog error, when loading the existing routine fails", async () => {
    vi.mocked(api.getRoutine).mockRejectedValue(new Error("network"));
    const b: RoutineBuilderContext = routineBuilder("edit");
    await b.init();
    expect(b.error).toBe("Could not load this routine.");
    expect(b.catalog).toEqual(CATALOG);
  });

  it("resetForm clears a create-mode draft without navigating", async () => {
    const b: RoutineBuilderContext = routineBuilder("create");
    await b.init();
    const nav = vi.spyOn(b, "navigate");
    b.name = "Draft";
    b.description = "notes";
    b.addStep(CATALOG[0]!);
    b.serverIssues = ["nope"];
    b.error = "boom";

    await b.resetForm();

    expect(b.name).toBe("");
    expect(b.description).toBe("");
    expect(b.steps).toEqual([]);
    expect(b.serverIssues).toEqual([]);
    expect(b.error).toBe("");
    expect(b.catalog).toEqual(CATALOG);
    expect(nav).not.toHaveBeenCalled();
  });

  it("resetForm restores the saved routine in edit mode without navigating", async () => {
    vi.mocked(api.getRoutine).mockResolvedValue(ROUTINE);
    const b: RoutineBuilderContext = routineBuilder("edit");
    await b.init();
    const nav = vi.spyOn(b, "navigate");
    const savedName = b.name;
    const savedSteps = b.steps.map(({ key: _key, ...rest }) => rest);
    b.name = "Edited";
    b.addStep(CATALOG[0]!);

    await b.resetForm();

    expect(b.name).toBe(savedName);
    expect(b.steps.map(({ key: _key, ...rest }) => rest)).toEqual(savedSteps);
    expect(nav).not.toHaveBeenCalled();
  });
});
