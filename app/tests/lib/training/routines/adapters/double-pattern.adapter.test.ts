// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { doublePatternAdapter } from "@lib/training/routines/adapters/double-pattern.adapter";
import type { RoutinePlayContext } from "@lib/types";
import type { StartTrainingStepResponseData } from "@client/api/types";

const CONFIGURATION = { patterns: [[20, 10, 5]] };

function makeContext(): RoutinePlayContext {
  return {
    doublePatternEngine: null,
    startStepTimer: vi.fn(),
  } as unknown as RoutinePlayContext;
}

function resultStub(): StartTrainingStepResponseData {
  return {
    sessionId: "s1",
    exerciseTypeKey: "DOUBLE_PATTERN",
    configuration: CONFIGURATION,
    participant: { ref: "pt1", displayName: "Levi" },
  } as StartTrainingStepResponseData;
}

describe("doublePatternAdapter", () => {
  it("declares its key, header label and panel", () => {
    expect(doublePatternAdapter.key).toBe("DOUBLE_PATTERN");
    expect(doublePatternAdapter.headerLabel).toBe("doubles");
    expect(doublePatternAdapter.panel).toBe("double-pattern");
    expect(doublePatternAdapter.completesOwnSession).toBe(false);
  });

  it("open() builds the double pattern engine and starts the step timer", () => {
    const ctx = makeContext();

    doublePatternAdapter.open(ctx, resultStub(), 300);

    expect(ctx.doublePatternEngine).not.toBeNull();
    expect(ctx.doublePatternEngine!.state().currentDoubleNumber).toBe(20);
    expect(ctx.startStepTimer).toHaveBeenCalledWith(300);
  });

  it("facts() reads the engine's own fact log, and is null before open()", () => {
    const ctx = makeContext();
    expect(doublePatternAdapter.facts(ctx)).toBeNull();

    doublePatternAdapter.open(ctx, resultStub(), 300);
    expect(doublePatternAdapter.facts(ctx)).toEqual(
      ctx.doublePatternEngine!.facts(),
    );
  });

  it("summarise() is null once the engine is closed, and reports doubles hit/darts/hit-rate while it is live", () => {
    const ctx = makeContext();
    expect(doublePatternAdapter.summarise(ctx)).toBeNull();
    doublePatternAdapter.open(ctx, resultStub(), 300);

    ctx.doublePatternEngine!.record({
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 0,
      locationY: -166,
    });

    expect(doublePatternAdapter.summarise(ctx)).toEqual({
      stepKey: "DOUBLE_PATTERN",
      label: "Doubles",
      rows: [
        { label: "Doubles hit", value: "1" },
        { label: "Darts", value: "1" },
        { label: "Hit rate", value: "100.00%" },
      ],
    });
  });

  it("close() nulls the engine", () => {
    const ctx = makeContext();
    doublePatternAdapter.open(ctx, resultStub(), 300);

    doublePatternAdapter.close(ctx);

    expect(ctx.doublePatternEngine).toBeNull();
  });
});
