import type { TrainingEngine, ExerciseEngine } from "@modules/interfaces";
import type { WarmUpState } from "@modules/types";
import type { SegmentTimer } from "@modules/ui/segment-timer.module";
import type {
  StartTrainingResponseData,
  StartTrainingStepResponseData,
} from "@client/api/types";
import type { SwitchingEngine } from "@modules/exercise/switching.engine.module";
import type { DoublePatternEngine } from "@modules/exercise/double-pattern.engine.module";
import type { DartObservation } from "@modules/types";
import type { BoardMarker } from "@lib/types";
import type { finishingStep } from "./finishing-step.data";

export type TrainingStepResolved = StartTrainingResponseData["steps"][number];

export type BalancedTrainingPlayContext = {
  loading: boolean;
  error: string;
  activityId: string | null;
  steps: TrainingStepResolved[];
  currentSessionId: string | null;
  currentParticipantRef: string | null;
  training: TrainingEngine | null;
  warmUpEngine: ExerciseEngine<WarmUpState> | null;
  switchingEngine: SwitchingEngine | null;
  doublePatternEngine: DoublePatternEngine | null;
  stepDeadline: ReturnType<typeof setTimeout> | null;
  warmUpTimer: SegmentTimer | null;
  warmUpElapsedSeconds: number;
  warmUpReady: boolean;
  warmUpConfiguration: Record<string, unknown> | null;
  finishing: ReturnType<typeof finishingStep> | null;
  $store: {
    game: {
      reset(): void;
      startSession(input: unknown): void;
    };
  };
  init(this: BalancedTrainingPlayContext): Promise<void>;
  currentStep(this: BalancedTrainingPlayContext): TrainingStepResolved | null;
  buildWarmUpEngine(
    this: BalancedTrainingPlayContext,
    configuration: Record<string, unknown>,
  ): void;
  buildSwitchingEngine(
    this: BalancedTrainingPlayContext,
    configuration: Record<string, unknown>,
  ): void;
  buildDoublePatternEngine(
    this: BalancedTrainingPlayContext,
    configuration: Record<string, unknown>,
  ): void;
  startFinishingStep(
    this: BalancedTrainingPlayContext,
    result: StartTrainingStepResponseData,
  ): void;
  startCurrentStep(this: BalancedTrainingPlayContext): Promise<void>;
  confirmWarmUpReady(this: BalancedTrainingPlayContext): void;
  startWarmUpTimer(
    this: BalancedTrainingPlayContext,
    configuration: Record<string, unknown>,
  ): void;
  formattedWarmUpElapsed(this: BalancedTrainingPlayContext): string;
  warmUpHighlightPath(this: BalancedTrainingPlayContext): string;
  armStepDeadline(
    this: BalancedTrainingPlayContext,
    durationSeconds: number,
  ): void;
  activeDartEngine(
    this: BalancedTrainingPlayContext,
  ): SwitchingEngine | DoublePatternEngine | null;
  visitMarkers(this: BalancedTrainingPlayContext): BoardMarker[];
  recordSwitchingDart(
    this: BalancedTrainingPlayContext,
    observation: DartObservation,
  ): void;
  recordDoublePatternDart(
    this: BalancedTrainingPlayContext,
    observation: DartObservation,
  ): void;
  undoVisit(this: BalancedTrainingPlayContext): void;
  uploadCurrentStepFacts(this: BalancedTrainingPlayContext): Promise<void>;
  completeCurrentStep(this: BalancedTrainingPlayContext): Promise<void>;
};
