// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { bullseyeCheckoutAdapter } from "@lib/training/routines/adapters/bullseye-checkout.adapter";
import type { RoutinePlayContext } from "@lib/types";
import type { StartTrainingStepResponseData } from "@client/api/types";

function makeContext(): RoutinePlayContext {
  return {
    bullseyeCheckoutEngine: null,
    startStepTimer: vi.fn(),
  } as unknown as RoutinePlayContext;
}

function resultStub(): StartTrainingStepResponseData {
  return {
    sessionId: "s1",
    exerciseTypeKey: "BULLSEYE_CHECKOUT",
    configuration: { startScore: 81 },
    participant: { ref: "pt1", displayName: "Levi" },
  } as StartTrainingStepResponseData;
}

const S19 = {
  hitTargetNumber: 19,
  hitZoneKey: "SINGLE" as const,
  locationX: 0,
  locationY: 0,
};
const S12 = {
  hitTargetNumber: 12,
  hitZoneKey: "SINGLE" as const,
  locationX: 0,
  locationY: 0,
};
const BULL = {
  hitTargetNumber: 25,
  hitZoneKey: "INNER_BULL" as const,
  locationX: 0,
  locationY: 0,
};

describe("bullseyeCheckoutAdapter", () => {
  it("declares its key, header label and panel", () => {
    expect(bullseyeCheckoutAdapter.key).toBe("BULLSEYE_CHECKOUT");
    expect(bullseyeCheckoutAdapter.headerLabel).toBe("Bullseye checkouts");
    expect(bullseyeCheckoutAdapter.panel).toBe("bullseye-checkout");
    expect(bullseyeCheckoutAdapter.completesOwnSession).toBe(false);
  });

  it("open() builds the engine and starts the step timer", () => {
    const ctx = makeContext();

    bullseyeCheckoutAdapter.open(ctx, resultStub(), 600);

    expect(ctx.bullseyeCheckoutEngine!.state().startScore).toBe(81);
    expect(ctx.startStepTimer).toHaveBeenCalledWith(600);
  });

  it("facts() reads the engine's fact log, and is null before open()", () => {
    const ctx = makeContext();
    expect(bullseyeCheckoutAdapter.facts(ctx)).toBeNull();

    bullseyeCheckoutAdapter.open(ctx, resultStub(), 600);
    expect(bullseyeCheckoutAdapter.facts(ctx)).toEqual(
      ctx.bullseyeCheckoutEngine!.facts(),
    );
  });

  it("summarise() is null before open(), and reports the live run after", () => {
    const ctx = makeContext();
    expect(bullseyeCheckoutAdapter.summarise(ctx)).toBeNull();
    bullseyeCheckoutAdapter.open(ctx, resultStub(), 600);

    [S19, S12, BULL].forEach((d) => ctx.bullseyeCheckoutEngine!.record(d));

    expect(bullseyeCheckoutAdapter.summarise(ctx)?.rows[0]).toEqual({
      label: "Checkouts",
      value: "1",
    });
  });

  it("close() nulls the engine", () => {
    const ctx = makeContext();
    bullseyeCheckoutAdapter.open(ctx, resultStub(), 600);

    bullseyeCheckoutAdapter.close(ctx);

    expect(ctx.bullseyeCheckoutEngine).toBeNull();
  });
});
