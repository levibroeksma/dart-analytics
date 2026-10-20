// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { switchingChainAdapter } from "@lib/training/routines/adapters/switching-chain.adapter";
import type { RoutinePlayContext } from "@lib/types";
import type { StartTrainingStepResponseData } from "@client/api/types";

function makeContext(): RoutinePlayContext {
  return {
    switchingChainEngine: null,
    startStepTimer: vi.fn(),
  } as unknown as RoutinePlayContext;
}

function resultStub(): StartTrainingStepResponseData {
  return {
    sessionId: "s1",
    exerciseTypeKey: "SWITCHING",
    configuration: { targets: [20, 19, 18] },
    participant: { ref: "pt1", displayName: "Levi" },
  } as StartTrainingStepResponseData;
}

describe("switchingChainAdapter", () => {
  it("declares its key, header label and panel", () => {
    expect(switchingChainAdapter.key).toBe("SWITCHING_CHAIN");
    expect(switchingChainAdapter.headerLabel).toBe("switching chain");
    expect(switchingChainAdapter.title).toBe("Switching Chain");
    expect(switchingChainAdapter.panel).toBe("switching-chain");
    expect(switchingChainAdapter.completesOwnSession).toBe(false);
  });

  it("open() builds the engine and starts the step timer", () => {
    const ctx = makeContext();

    switchingChainAdapter.open(ctx, resultStub(), 600);

    expect(ctx.switchingChainEngine!.state().currentTargetNumber).toBe(20);
    expect(ctx.startStepTimer).toHaveBeenCalledWith(600);
  });

  it("facts() reads the engine's fact log, and is null before open()", () => {
    const ctx = makeContext();
    expect(switchingChainAdapter.facts(ctx)).toBeNull();

    switchingChainAdapter.open(ctx, resultStub(), 600);
    expect(switchingChainAdapter.facts(ctx)).toEqual(
      ctx.switchingChainEngine!.facts(),
    );
  });

  it("summarise() is null before open(), and reports the live run after", () => {
    const ctx = makeContext();
    expect(switchingChainAdapter.summarise(ctx)).toBeNull();
    switchingChainAdapter.open(ctx, resultStub(), 600);

    ctx.switchingChainEngine!.record({
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: 0,
      locationY: 0,
    });

    expect(switchingChainAdapter.summarise(ctx)?.rows[0]).toEqual({
      label: "Best chain",
      value: "3",
    });
  });

  it("close() nulls the engine", () => {
    const ctx = makeContext();
    switchingChainAdapter.open(ctx, resultStub(), 600);

    switchingChainAdapter.close(ctx);

    expect(ctx.switchingChainEngine).toBeNull();
  });
});
