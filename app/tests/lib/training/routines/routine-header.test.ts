import { describe, it, expect } from "vitest";
import { routineHeader } from "@lib/training/routines/routine-header";
import type { RoutineHeaderInput } from "@lib/types";

const base: RoutineHeaderInput = {
  routineName: "Pre-match warm-up",
  ready: true,
  finished: false,
  stepIndex: 1,
  stepCount: 5,
  adapter: { title: "Switching", panel: "switching" },
  stepRemaining: "3:48",
  warmUpElapsed: "0:00",
};

describe("routineHeader", () => {
  it("names the step and its position while a scored step runs", () => {
    expect(routineHeader(base)).toEqual({
      title: "Switching",
      subtitle: "STEP 2 OF 5",
      clock: "3:48",
      clockLabel: "Step time remaining",
    });
  });

  it("shows the Warm-Up's elapsed time instead of a countdown", () => {
    const header = routineHeader({
      ...base,
      stepIndex: 0,
      adapter: { title: "Warm-Up", panel: "warm-up" },
      stepRemaining: null,
      warmUpElapsed: "0:42",
    });
    expect(header.clock).toBe("0:42");
    expect(header.clockLabel).toBe("Elapsed");
  });

  it("shows no clock on a game step, which keeps its own countdown", () => {
    const header = routineHeader({
      ...base,
      adapter: { title: "Ten Up One Down", panel: "tuod" },
      stepRemaining: null,
    });
    expect(header.title).toBe("Ten Up One Down");
    expect(header.clock).toBe("");
  });

  it("names the routine, with no subtitle or clock, behind the ready gate", () => {
    expect(routineHeader({ ...base, ready: false, adapter: null })).toEqual({
      title: "Pre-match warm-up",
      subtitle: "",
      clock: "",
      clockLabel: "",
    });
  });

  it("names the routine as complete once the last step finishes", () => {
    expect(routineHeader({ ...base, finished: true })).toEqual({
      title: "Pre-match warm-up",
      subtitle: "COMPLETE",
      clock: "",
      clockLabel: "",
    });
  });
});
