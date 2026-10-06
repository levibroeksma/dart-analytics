// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { checkoutSequenceAdapter } from "@lib/training/routines/adapters/checkout-sequence.adapter";
import type { RoutinePlayContext } from "@lib/types";
import type { StartTrainingStepResponseData } from "@client/api/types";

function makeContext(): RoutinePlayContext {
  return {
    checkoutSequenceEngine: null,
    startStepTimer: vi.fn(),
  } as unknown as RoutinePlayContext;
}

function resultStub(): StartTrainingStepResponseData {
  return {
    sessionId: "s1",
    exerciseTypeKey: "CHECKOUT_SEQUENCE",
    configuration: { firstOutshot: 61, lastOutshot: 100, dartLimit: 6 },
    participant: { ref: "pt1", displayName: "Levi" },
  } as StartTrainingStepResponseData;
}

const T15 = {
  hitTargetNumber: 15,
  hitZoneKey: "TREBLE" as const,
  locationX: 0,
  locationY: 0,
};
const D8 = { ...T15, hitTargetNumber: 8, hitZoneKey: "DOUBLE" as const };

describe("checkoutSequenceAdapter", () => {
  it("declares its key, header label and panel", () => {
    expect(checkoutSequenceAdapter.key).toBe("CHECKOUT_SEQUENCE");
    expect(checkoutSequenceAdapter.headerLabel).toBe("Catch 40");
    expect(checkoutSequenceAdapter.panel).toBe("checkout-sequence");
    expect(checkoutSequenceAdapter.completesOwnSession).toBe(false);
  });

  it("open() builds the engine and starts the step timer", () => {
    const ctx = makeContext();

    checkoutSequenceAdapter.open(ctx, resultStub(), 1800);

    expect(ctx.checkoutSequenceEngine!.state().currentOutshot).toBe(61);
    expect(ctx.startStepTimer).toHaveBeenCalledWith(1800);
  });

  it("facts() reads the engine's fact log, and is null before open()", () => {
    const ctx = makeContext();
    expect(checkoutSequenceAdapter.facts(ctx)).toBeNull();

    checkoutSequenceAdapter.open(ctx, resultStub(), 1800);
    expect(checkoutSequenceAdapter.facts(ctx)).toEqual(
      ctx.checkoutSequenceEngine!.facts(),
    );
  });

  it("summarise() is null before open(), and reports the live run after", () => {
    const ctx = makeContext();
    expect(checkoutSequenceAdapter.summarise(ctx)).toBeNull();
    checkoutSequenceAdapter.open(ctx, resultStub(), 1800);

    ctx.checkoutSequenceEngine!.record(T15);
    ctx.checkoutSequenceEngine!.record(D8);

    expect(checkoutSequenceAdapter.summarise(ctx)?.rows[0]).toEqual({
      label: "Points",
      value: "3",
    });
  });

  it("close() nulls the engine", () => {
    const ctx = makeContext();
    checkoutSequenceAdapter.open(ctx, resultStub(), 1800);

    checkoutSequenceAdapter.close(ctx);

    expect(ctx.checkoutSequenceEngine).toBeNull();
  });
});
