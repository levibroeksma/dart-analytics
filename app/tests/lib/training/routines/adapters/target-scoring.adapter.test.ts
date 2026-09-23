// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { targetScoringAdapter } from "@lib/training/routines/adapters/target-scoring.adapter";
import type { RoutinePlayContext } from "@lib/types";
import type { StartTrainingStepResponseData } from "@client/api/types";

function makeContext(): RoutinePlayContext {
  return {
    targetScoringEngine: null,
    startStepTimer: vi.fn(),
  } as unknown as RoutinePlayContext;
}

function resultStub(): StartTrainingStepResponseData {
  return {
    sessionId: "s1",
    exerciseTypeKey: "TARGET_SCORING",
    configuration: { targets: [20, 19, 18, 25] },
    participant: { ref: "pt1", displayName: "Levi" },
  } as StartTrainingStepResponseData;
}

describe("targetScoringAdapter", () => {
  it("declares its key, header label and panel", () => {
    expect(targetScoringAdapter.key).toBe("TARGET_SCORING");
    expect(targetScoringAdapter.headerLabel).toBe("target scoring");
    expect(targetScoringAdapter.panel).toBe("target-scoring");
    expect(targetScoringAdapter.completesOwnSession).toBe(false);
  });

  it("open() builds the engine and starts the step timer", () => {
    const ctx = makeContext();

    targetScoringAdapter.open(ctx, resultStub(), 600);

    expect(ctx.targetScoringEngine!.state().currentTargetNumber).toBe(20);
    expect(ctx.startStepTimer).toHaveBeenCalledWith(600);
  });

  it("facts() reads the engine's fact log, and is null before open()", () => {
    const ctx = makeContext();
    expect(targetScoringAdapter.facts(ctx)).toBeNull();

    targetScoringAdapter.open(ctx, resultStub(), 600);
    expect(targetScoringAdapter.facts(ctx)).toEqual(
      ctx.targetScoringEngine!.facts(),
    );
  });

  it("summarise() is null before open(), and reports the live run after", () => {
    const ctx = makeContext();
    expect(targetScoringAdapter.summarise(ctx)).toBeNull();
    targetScoringAdapter.open(ctx, resultStub(), 600);

    ctx.targetScoringEngine!.record({
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: 0,
      locationY: 0,
    });

    expect(targetScoringAdapter.summarise(ctx)?.rows[0]).toEqual({
      label: "Best chain",
      value: "3",
    });
  });

  it("close() nulls the engine", () => {
    const ctx = makeContext();
    targetScoringAdapter.open(ctx, resultStub(), 600);

    targetScoringAdapter.close(ctx);

    expect(ctx.targetScoringEngine).toBeNull();
  });
});
