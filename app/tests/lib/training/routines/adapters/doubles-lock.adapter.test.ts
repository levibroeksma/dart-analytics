// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { doublesLockAdapter } from "@lib/training/routines/adapters/doubles-lock.adapter";
import { DoublesLockEngine } from "@modules/training/exercises/doubles-lock.engine.module";
import type { RoutinePlayContext } from "@lib/types";
import type { StartTrainingStepResponseData } from "@client/api/types";

function makeContext(): RoutinePlayContext {
  return {
    doublesLockEngine: null,
    startStepTimer: vi.fn(),
  } as unknown as RoutinePlayContext;
}

function resultStub(): StartTrainingStepResponseData {
  return {
    sessionId: "s1",
    exerciseTypeKey: "DOUBLES_LOCK",
    configuration: {},
    participant: { ref: "pt1", displayName: "Levi" },
  } as StartTrainingStepResponseData;
}

const D20 = {
  hitTargetNumber: 20,
  hitZoneKey: "DOUBLE" as const,
  locationX: 0,
  locationY: 0,
};

describe("doublesLockAdapter", () => {
  it("declares its key, header label and panel", () => {
    expect(doublesLockAdapter.key).toBe("DOUBLES_LOCK");
    expect(doublesLockAdapter.headerLabel).toBe("Doubles Lock");
    expect(doublesLockAdapter.title).toBe("Doubles Lock");
    expect(doublesLockAdapter.panel).toBe("doubles-lock");
    expect(doublesLockAdapter.completesOwnSession).toBe(false);
  });

  it("open() builds the engine on D20 and starts the step timer", () => {
    const ctx = makeContext();

    doublesLockAdapter.open(ctx, resultStub(), 600);

    expect(ctx.doublesLockEngine).toBeInstanceOf(DoublesLockEngine);
    expect(ctx.doublesLockEngine!.state().currentDouble).toEqual({
      kind: "DOUBLE",
      number: 20,
    });
    expect(ctx.startStepTimer).toHaveBeenCalledWith(600);
  });

  it("facts() reads the engine's fact log, and is null before open()", () => {
    const ctx = makeContext();
    expect(doublesLockAdapter.facts(ctx)).toBeNull();

    doublesLockAdapter.open(ctx, resultStub(), 600);
    ctx.doublesLockEngine!.record(D20);
    expect(doublesLockAdapter.facts(ctx)).toEqual(
      ctx.doublesLockEngine!.facts(),
    );
  });

  it("summarise() is null before open(), and reports the live run after", () => {
    const ctx = makeContext();
    expect(doublesLockAdapter.summarise(ctx)).toBeNull();
    doublesLockAdapter.open(ctx, resultStub(), 600);

    ctx.doublesLockEngine!.record(D20);

    const summary = doublesLockAdapter.summarise(ctx);
    expect(summary?.stepKey).toBe("DOUBLES_LOCK");
    expect(summary?.rows[0]).toEqual({ label: "Bonus", value: "0" });
  });

  it("close() nulls the engine", () => {
    const ctx = makeContext();
    doublesLockAdapter.open(ctx, resultStub(), 600);

    doublesLockAdapter.close(ctx);

    expect(ctx.doublesLockEngine).toBeNull();
  });
});
