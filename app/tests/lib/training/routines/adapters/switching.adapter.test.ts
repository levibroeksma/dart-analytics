// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { switchingAdapter } from "@lib/training/routines/adapters/switching.adapter";
import type { RoutinePlayContext } from "@lib/types";
import type { StartTrainingStepResponseData } from "@client/api/types";

const CONFIGURATION = {
  targets: [20, 19, 18],
  scoring: { single: 1, double: 2, treble: 3 },
};

function makeContext(): RoutinePlayContext {
  return {
    switchingEngine: null,
    startStepTimer: vi.fn(),
  } as unknown as RoutinePlayContext;
}

function resultStub(): StartTrainingStepResponseData {
  return {
    sessionId: "s1",
    exerciseTypeKey: "SWITCHING",
    configuration: CONFIGURATION,
    participant: { ref: "pt1", displayName: "Levi" },
  } as StartTrainingStepResponseData;
}

describe("switchingAdapter", () => {
  it("declares its key, header label and panel", () => {
    expect(switchingAdapter.key).toBe("SWITCHING");
    expect(switchingAdapter.headerLabel).toBe("switching");
    expect(switchingAdapter.panel).toBe("switching");
    expect(switchingAdapter.completesOwnSession).toBe(false);
  });

  it("open() builds the switching engine and starts the step timer", () => {
    const ctx = makeContext();

    switchingAdapter.open(ctx, resultStub(), 300);

    expect(ctx.switchingEngine).not.toBeNull();
    expect(ctx.switchingEngine!.state().currentTargetNumber).toBe(20);
    expect(ctx.startStepTimer).toHaveBeenCalledWith(300);
  });

  it("facts() reads the engine's own fact log, and is null before open()", () => {
    const ctx = makeContext();
    expect(switchingAdapter.facts(ctx)).toBeNull();

    switchingAdapter.open(ctx, resultStub(), 300);
    expect(switchingAdapter.facts(ctx)).toEqual(ctx.switchingEngine!.facts());
  });

  it("summarise() is null once the engine is closed, and reports points/darts/hit-rate while it is live", () => {
    const ctx = makeContext();
    expect(switchingAdapter.summarise(ctx)).toBeNull();
    switchingAdapter.open(ctx, resultStub(), 300);

    ctx.switchingEngine!.record({
      hitTargetNumber: 20,
      hitZoneKey: "SINGLE",
      locationX: 0,
      locationY: 0,
    });

    expect(switchingAdapter.summarise(ctx)).toEqual({
      stepKey: "SWITCHING",
      label: "Switching",
      rows: [
        { label: "Points", value: "1" },
        { label: "Darts", value: "1" },
        { label: "Hit rate", value: "100.00%" },
      ],
    });
  });

  it("close() nulls the engine", () => {
    const ctx = makeContext();
    switchingAdapter.open(ctx, resultStub(), 300);

    switchingAdapter.close(ctx);

    expect(ctx.switchingEngine).toBeNull();
  });
});
