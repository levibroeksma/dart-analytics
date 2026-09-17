import type {
  RoutineSnapshot,
  RoutineStepSnapshot,
  TrainingState,
} from "@modules/types";
import type { TrainingEngine } from "./interfaces";

function cloneStep(step: RoutineStepSnapshot): RoutineStepSnapshot {
  return { ...step, configuration: { ...step.configuration } };
}

class OrderedTraining implements TrainingEngine {
  private readonly snapshot: RoutineSnapshot;
  private completedStepCount: number;

  constructor(snapshot: RoutineSnapshot, completedStepCount: number) {
    if (snapshot.steps.length === 0) {
      throw new Error("a routine snapshot must hold at least one step");
    }
    this.snapshot = snapshot;
    this.completedStepCount = Math.min(
      Math.max(completedStepCount, 0),
      snapshot.steps.length,
    );
  }

  private get stepIndex(): number {
    return Math.min(this.completedStepCount, this.snapshot.steps.length - 1);
  }

  state(): TrainingState {
    return {
      stepIndex: this.stepIndex,
      stepCount: this.snapshot.steps.length,
      currentStep: cloneStep(this.snapshot.steps[this.stepIndex]),
      completedStepCount: this.completedStepCount,
      status: this.isComplete() ? "COMPLETE" : "IN_PROGRESS",
    };
  }

  completeStep(): TrainingState {
    if (!this.isComplete()) this.completedStepCount += 1;
    return this.state();
  }

  isComplete(): boolean {
    return this.completedStepCount >= this.snapshot.steps.length;
  }
}

export const trainingEngine = {
  create(snapshot: RoutineSnapshot, completedStepCount = 0): TrainingEngine {
    return new OrderedTraining(snapshot, completedStepCount);
  },
};
