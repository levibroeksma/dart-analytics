// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { hitCountAdapter } from "@lib/training/routines/adapters/hit-count.adapter";
import type { RoutinePlayContext } from "@lib/types";
import type { StartTrainingStepResponseData } from "@client/api/types";

function makeContext(): RoutinePlayContext {
  return {
    hitCountEngine: null,
    startStepTimer: vi.fn(),
  } as unknown as RoutinePlayContext;
}

function resultStub(): StartTrainingStepResponseData {
  return {
    sessionId: "s1",
    exerciseTypeKey: "HIT_COUNT",
    configuration: {
      targets: [20, 19, 18, 17].map((number) => ({ kind: "TREBLE", number })),
      dartsPerTarget: 9,
    },
    participant: { ref: "pt1", displayName: "Levi" },
  } as StartTrainingStepResponseData;
}

const T20 = {
  hitTargetNumber: 20,
  hitZoneKey: "TREBLE" as const,
  locationX: 0,
  locationY: 0,
};

describe("hitCountAdapter", () => {
  it("declares its key, header label and panel", () => {
    expect(hitCountAdapter.key).toBe("HIT_COUNT");
    expect(hitCountAdapter.headerLabel).toBe("Hit Count");
    expect(hitCountAdapter.title).toBe("Hit Count");
    expect(hitCountAdapter.panel).toBe("hit-count");
    expect(hitCountAdapter.completesOwnSession).toBe(false);
  });

  it("open() builds the engine on the first target and starts the step timer", () => {
    const ctx = makeContext();

    hitCountAdapter.open(ctx, resultStub(), 600);

    expect(ctx.hitCountEngine!.state().currentTarget).toEqual({
      kind: "TREBLE",
      number: 20,
    });
    expect(ctx.startStepTimer).toHaveBeenCalledWith(600);
  });

  it("facts() reads the engine's fact log, and is null before open()", () => {
    const ctx = makeContext();
    expect(hitCountAdapter.facts(ctx)).toBeNull();

    hitCountAdapter.open(ctx, resultStub(), 600);
    ctx.hitCountEngine!.record(T20);
    expect(hitCountAdapter.facts(ctx)).toEqual(ctx.hitCountEngine!.facts());
  });

  it("summarise() is null before open(), and reports the live run after", () => {
    const ctx = makeContext();
    expect(hitCountAdapter.summarise(ctx)).toBeNull();
    hitCountAdapter.open(ctx, resultStub(), 600);

    ctx.hitCountEngine!.record(T20);

    const summary = hitCountAdapter.summarise(ctx);
    expect(summary?.stepKey).toBe("HIT_COUNT");
    expect(summary?.rows[0]).toEqual({ label: "Hits", value: "1" });
  });

  it("close() nulls the engine", () => {
    const ctx = makeContext();
    hitCountAdapter.open(ctx, resultStub(), 600);

    hitCountAdapter.close(ctx);

    expect(ctx.hitCountEngine).toBeNull();
  });
});
