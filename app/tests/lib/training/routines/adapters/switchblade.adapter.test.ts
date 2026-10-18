// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { switchbladeAdapter } from "@lib/training/routines/adapters/switchblade.adapter";
import { SwitchbladeEngine } from "@modules/training/exercises/switchblade.engine.module";
import type { RoutinePlayContext } from "@lib/types";
import type { StartTrainingStepResponseData } from "@client/api/types";

function makeContext(): RoutinePlayContext {
  return {
    switchbladeEngine: null,
    startStepTimer: vi.fn(),
  } as unknown as RoutinePlayContext;
}

function resultStub(): StartTrainingStepResponseData {
  return {
    sessionId: "s1",
    exerciseTypeKey: "SWITCHBLADE",
    configuration: {},
    participant: { ref: "pt1", displayName: "Levi" },
  } as StartTrainingStepResponseData;
}

const T20 = {
  hitTargetNumber: 20,
  hitZoneKey: "TREBLE" as const,
  locationX: 0,
  locationY: 0,
};

describe("switchbladeAdapter", () => {
  it("declares its key, header label and panel", () => {
    expect(switchbladeAdapter.key).toBe("SWITCHBLADE");
    expect(switchbladeAdapter.headerLabel).toBe("SwitchBlade");
    expect(switchbladeAdapter.title).toBe("SwitchBlade");
    expect(switchbladeAdapter.panel).toBe("switchblade");
    expect(switchbladeAdapter.completesOwnSession).toBe(false);
  });

  it("open() builds the engine on the first slot and starts the step timer", () => {
    const ctx = makeContext();

    switchbladeAdapter.open(ctx, resultStub(), 600);

    expect(ctx.switchbladeEngine).toBeInstanceOf(SwitchbladeEngine);
    expect(ctx.switchbladeEngine!.state().currentSlot).toEqual({
      kind: "TREBLE",
      number: 20,
    });
    expect(ctx.startStepTimer).toHaveBeenCalledWith(600);
  });

  it("facts() reads the engine's fact log, and is null before open()", () => {
    const ctx = makeContext();
    expect(switchbladeAdapter.facts(ctx)).toBeNull();

    switchbladeAdapter.open(ctx, resultStub(), 600);
    ctx.switchbladeEngine!.record(T20);
    expect(switchbladeAdapter.facts(ctx)).toEqual(
      ctx.switchbladeEngine!.facts(),
    );
  });

  it("summarise() is null before open(), and reports the live run after", () => {
    const ctx = makeContext();
    expect(switchbladeAdapter.summarise(ctx)).toBeNull();
    switchbladeAdapter.open(ctx, resultStub(), 600);

    ctx.switchbladeEngine!.record(T20);

    const summary = switchbladeAdapter.summarise(ctx);
    expect(summary?.stepKey).toBe("SWITCHBLADE");
    expect(summary?.rows[0]).toEqual({ label: "Total", value: "60" });
  });

  it("close() nulls the engine", () => {
    const ctx = makeContext();
    switchbladeAdapter.open(ctx, resultStub(), 600);

    switchbladeAdapter.close(ctx);

    expect(ctx.switchbladeEngine).toBeNull();
  });
});
