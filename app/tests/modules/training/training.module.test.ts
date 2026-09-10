import { describe, expect, it } from "vitest";
import { trainingEngine } from "@modules/training/training.module";
import type { RoutineSnapshot } from "@modules/types";

const SNAPSHOT: RoutineSnapshot = {
  routineName: "Warm-Up",
  steps: [
    {
      sequenceNumber: 1,
      exerciseName: "Warm-Up",
      exerciseRulesetVersionKey: "WARM_UP_V1",
      configuration: { phases: [] },
    },
    {
      sequenceNumber: 2,
      exerciseName: "Warm-Up",
      exerciseRulesetVersionKey: "WARM_UP_V1",
      configuration: { phases: [] },
    },
  ],
};

describe("trainingEngine", () => {
  it("starts on the first step", () => {
    const training = trainingEngine.create(SNAPSHOT);

    expect(training.state()).toEqual({
      stepIndex: 0,
      stepCount: 2,
      currentStep: SNAPSHOT.steps[0],
      completedStepCount: 0,
      status: "IN_PROGRESS",
    });
  });

  it("advances to the next step when one completes", () => {
    const training = trainingEngine.create(SNAPSHOT);

    const state = training.completeStep();

    expect(state.stepIndex).toBe(1);
    expect(state.completedStepCount).toBe(1);
    expect(state.status).toBe("IN_PROGRESS");
  });

  it("completes when the final step completes", () => {
    const training = trainingEngine.create(SNAPSHOT);
    training.completeStep();

    const state = training.completeStep();

    expect(state.status).toBe("COMPLETE");
    expect(state.completedStepCount).toBe(2);
    expect(training.isComplete()).toBe(true);
  });

  it("resumes from a completed step count", () => {
    const training = trainingEngine.create(SNAPSHOT, 1);

    expect(training.state().stepIndex).toBe(1);
    expect(training.state().completedStepCount).toBe(1);
  });

  it("stays on the last step once complete", () => {
    const training = trainingEngine.create(SNAPSHOT, 2);

    expect(training.state().status).toBe("COMPLETE");
    expect(training.state().stepIndex).toBe(1);
    expect(training.completeStep().completedStepCount).toBe(2);
  });

  it("rejects a routine with no steps", () => {
    expect(() =>
      trainingEngine.create({ routineName: "Empty", steps: [] }),
    ).toThrow(/at least one step/);
  });

  it("returns a copy of the current step, not a live reference", () => {
    const training = trainingEngine.create(SNAPSHOT);

    const step = training.state().currentStep;

    expect(step).not.toBe(SNAPSHOT.steps[0]);
    expect(step).toEqual(SNAPSHOT.steps[0]);
  });
});
