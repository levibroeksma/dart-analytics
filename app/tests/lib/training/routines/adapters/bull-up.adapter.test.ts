// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { bullUpAdapter } from "@lib/training/routines/adapters/bull-up.adapter";
import type { RoutinePlayContext } from "@lib/types";
import type { StartTrainingStepResponseData } from "@client/api/types";

function makeContext(): RoutinePlayContext {
  return {
    bullUpEngine: null,
    startStepTimer: vi.fn(),
  } as unknown as RoutinePlayContext;
}

function resultStub(): StartTrainingStepResponseData {
  return {
    sessionId: "s1",
    exerciseTypeKey: "BULL_UP",
    configuration: {},
    participant: { ref: "pt1", displayName: "Levi" },
  } as StartTrainingStepResponseData;
}

const BULL = {
  hitTargetNumber: 25,
  hitZoneKey: "INNER_BULL" as const,
  locationX: 0,
  locationY: 0,
};

describe("bullUpAdapter", () => {
  it("declares its key, header label and panel", () => {
    expect(bullUpAdapter.key).toBe("BULL_UP");
    expect(bullUpAdapter.headerLabel).toBe("Bull up practice");
    expect(bullUpAdapter.panel).toBe("bull-up");
    expect(bullUpAdapter.completesOwnSession).toBe(false);
  });

  it("open() builds the engine and starts the step timer", () => {
    const ctx = makeContext();

    bullUpAdapter.open(ctx, resultStub(), 300);

    expect(ctx.bullUpEngine!.state().throws).toBe(0);
    expect(ctx.startStepTimer).toHaveBeenCalledWith(300);
  });

  it("facts() reads the engine's fact log, and is null before open()", () => {
    const ctx = makeContext();
    expect(bullUpAdapter.facts(ctx)).toBeNull();

    bullUpAdapter.open(ctx, resultStub(), 300);
    expect(bullUpAdapter.facts(ctx)).toEqual(ctx.bullUpEngine!.facts());
  });

  it("summarise() is null before open(), and reports the live run after", () => {
    const ctx = makeContext();
    expect(bullUpAdapter.summarise(ctx)).toBeNull();
    bullUpAdapter.open(ctx, resultStub(), 300);

    ctx.bullUpEngine!.record(BULL);

    expect(bullUpAdapter.summarise(ctx)?.rows[1]).toEqual({
      label: "Bullseyes",
      value: "1",
    });
  });

  it("close() nulls the engine", () => {
    const ctx = makeContext();
    bullUpAdapter.open(ctx, resultStub(), 300);

    bullUpAdapter.close(ctx);

    expect(ctx.bullUpEngine).toBeNull();
  });
});
