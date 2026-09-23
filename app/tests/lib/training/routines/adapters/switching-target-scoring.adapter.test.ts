// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { switchingTargetScoringAdapter } from "@lib/training/routines/adapters/switching-target-scoring.adapter";
import type { RoutinePlayContext } from "@lib/types";
import type { StartTrainingStepResponseData } from "@client/api/types";

function makeContext(): RoutinePlayContext {
  return {
    switchingTargetScoringEngine: null,
    startStepTimer: vi.fn(),
  } as unknown as RoutinePlayContext;
}

function resultStub(): StartTrainingStepResponseData {
  return {
    sessionId: "s1",
    exerciseTypeKey: "SWITCHING_TARGET_SCORING",
    configuration: { targets: [20, 19, 18] },
    participant: { ref: "pt1", displayName: "Levi" },
  } as StartTrainingStepResponseData;
}

describe("switchingTargetScoringAdapter", () => {
  it("declares its key, header label and panel", () => {
    expect(switchingTargetScoringAdapter.key).toBe("SWITCHING_TARGET_SCORING");
    expect(switchingTargetScoringAdapter.headerLabel).toBe(
      "switching target scoring",
    );
    expect(switchingTargetScoringAdapter.panel).toBe(
      "switching-target-scoring",
    );
    expect(switchingTargetScoringAdapter.completesOwnSession).toBe(false);
  });

  it("open() builds the engine and starts the step timer", () => {
    const ctx = makeContext();

    switchingTargetScoringAdapter.open(ctx, resultStub(), 600);

    expect(ctx.switchingTargetScoringEngine!.state().currentTargetNumber).toBe(
      20,
    );
    expect(ctx.startStepTimer).toHaveBeenCalledWith(600);
  });

  it("facts() reads the engine's fact log, and is null before open()", () => {
    const ctx = makeContext();
    expect(switchingTargetScoringAdapter.facts(ctx)).toBeNull();

    switchingTargetScoringAdapter.open(ctx, resultStub(), 600);
    expect(switchingTargetScoringAdapter.facts(ctx)).toEqual(
      ctx.switchingTargetScoringEngine!.facts(),
    );
  });

  it("summarise() is null before open(), and reports the live run after", () => {
    const ctx = makeContext();
    expect(switchingTargetScoringAdapter.summarise(ctx)).toBeNull();
    switchingTargetScoringAdapter.open(ctx, resultStub(), 600);

    ctx.switchingTargetScoringEngine!.record({
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: 0,
      locationY: 0,
    });

    expect(switchingTargetScoringAdapter.summarise(ctx)?.rows[0]).toEqual({
      label: "Best chain",
      value: "3",
    });
  });

  it("close() nulls the engine", () => {
    const ctx = makeContext();
    switchingTargetScoringAdapter.open(ctx, resultStub(), 600);

    switchingTargetScoringAdapter.close(ctx);

    expect(ctx.switchingTargetScoringEngine).toBeNull();
  });
});
