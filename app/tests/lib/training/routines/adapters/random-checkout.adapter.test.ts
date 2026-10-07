// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { randomCheckoutAdapter } from "@lib/training/routines/adapters/random-checkout.adapter";
import type { RoutinePlayContext } from "@lib/types";
import type { StartTrainingStepResponseData } from "@client/api/types";

function makeContext(): RoutinePlayContext {
  return {
    randomCheckoutEngine: null,
    startStepTimer: vi.fn(),
  } as unknown as RoutinePlayContext;
}

function resultStub(): StartTrainingStepResponseData {
  return {
    sessionId: "s1",
    exerciseTypeKey: "RANDOM_CHECKOUT",
    configuration: { minStart: 40, maxStart: 170, drawSeed: 774 },
    participant: { ref: "pt1", displayName: "Levi" },
  } as StartTrainingStepResponseData;
}

const D20 = {
  hitTargetNumber: 20,
  hitZoneKey: "DOUBLE" as const,
  locationX: 0,
  locationY: 0,
};

describe("randomCheckoutAdapter", () => {
  it("declares its key, header label and panel", () => {
    expect(randomCheckoutAdapter.key).toBe("RANDOM_CHECKOUT");
    expect(randomCheckoutAdapter.headerLabel).toBe("Random Checkout");
    expect(randomCheckoutAdapter.panel).toBe("random-checkout");
    expect(randomCheckoutAdapter.completesOwnSession).toBe(false);
  });

  it("open() builds the engine from the seeded draw and starts the step timer", () => {
    const ctx = makeContext();

    randomCheckoutAdapter.open(ctx, resultStub(), 600);

    expect(ctx.randomCheckoutEngine!.state().startScore).toBe(40);
    expect(ctx.startStepTimer).toHaveBeenCalledWith(600);
  });

  it("facts() reads the engine's fact log, and is null before open()", () => {
    const ctx = makeContext();
    expect(randomCheckoutAdapter.facts(ctx)).toBeNull();

    randomCheckoutAdapter.open(ctx, resultStub(), 600);
    expect(randomCheckoutAdapter.facts(ctx)).toEqual(
      ctx.randomCheckoutEngine!.facts(),
    );
  });

  it("summarise() is null before open(), and reports the live run after", () => {
    const ctx = makeContext();
    expect(randomCheckoutAdapter.summarise(ctx)).toBeNull();
    randomCheckoutAdapter.open(ctx, resultStub(), 600);

    ctx.randomCheckoutEngine!.record(D20);

    expect(randomCheckoutAdapter.summarise(ctx)?.rows[0]).toEqual({
      label: "Checkouts",
      value: "1",
    });
  });

  it("close() nulls the engine", () => {
    const ctx = makeContext();
    randomCheckoutAdapter.open(ctx, resultStub(), 600);

    randomCheckoutAdapter.close(ctx);

    expect(ctx.randomCheckoutEngine).toBeNull();
  });
});
