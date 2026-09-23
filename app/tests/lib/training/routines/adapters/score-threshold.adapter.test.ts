// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { scoreThresholdAdapter } from "@lib/training/routines/adapters/score-threshold.adapter";
import type { RoutinePlayContext } from "@lib/types";
import type { StartTrainingStepResponseData } from "@client/api/types";

function makeContext(): RoutinePlayContext {
  return {
    scoreThresholdEngine: null,
    startStepTimer: vi.fn(),
  } as unknown as RoutinePlayContext;
}

function resultStub(): StartTrainingStepResponseData {
  return {
    sessionId: "s1",
    exerciseTypeKey: "SCORE_THRESHOLD",
    configuration: { threshold: 65 },
    participant: { ref: "pt1", displayName: "Levi" },
  } as StartTrainingStepResponseData;
}

describe("scoreThresholdAdapter", () => {
  it("declares its key, header label and panel", () => {
    expect(scoreThresholdAdapter.key).toBe("SCORE_THRESHOLD");
    expect(scoreThresholdAdapter.headerLabel).toBe("65 or more");
    expect(scoreThresholdAdapter.panel).toBe("score-threshold");
    expect(scoreThresholdAdapter.completesOwnSession).toBe(false);
  });

  it("open() builds the engine and starts the step timer", () => {
    const ctx = makeContext();

    scoreThresholdAdapter.open(ctx, resultStub(), 600);

    expect(ctx.scoreThresholdEngine!.state().threshold).toBe(65);
    expect(ctx.startStepTimer).toHaveBeenCalledWith(600);
  });

  it("facts() reads the engine's fact log, and is null before open()", () => {
    const ctx = makeContext();
    expect(scoreThresholdAdapter.facts(ctx)).toBeNull();

    scoreThresholdAdapter.open(ctx, resultStub(), 600);
    expect(scoreThresholdAdapter.facts(ctx)).toEqual(
      ctx.scoreThresholdEngine!.facts(),
    );
  });

  it("summarise() is null before open(), and reports the live run after", () => {
    const ctx = makeContext();
    expect(scoreThresholdAdapter.summarise(ctx)).toBeNull();
    scoreThresholdAdapter.open(ctx, resultStub(), 600);

    for (let i = 0; i < 3; i++) {
      ctx.scoreThresholdEngine!.record({
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        locationX: 0,
        locationY: 0,
      });
    }

    expect(scoreThresholdAdapter.summarise(ctx)?.rows[0]).toEqual({
      label: "Beats",
      value: "1",
    });
  });

  it("close() nulls the engine", () => {
    const ctx = makeContext();
    scoreThresholdAdapter.open(ctx, resultStub(), 600);

    scoreThresholdAdapter.close(ctx);

    expect(ctx.scoreThresholdEngine).toBeNull();
  });
});
