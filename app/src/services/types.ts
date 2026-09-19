import type { ErrorCode } from "@server/types";

export * from "./exercise-rulesets/types";
export * from "./rulesets/types";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; details?: Record<string, unknown> };

export type CreateSessionResult = {
  sessionId: string;
  participants: {
    ref: string;
    participantTypeKey: "PLAYER" | "GUEST" | "DARTBOT";
    displayName: string;
    dartbot?: { level: number; seed: number; levelSource: "MANUAL" };
  }[];
};

/** A player's default capture and input modes, as implementation keys. */
export type PlayerSettings = {
  defaultCaptureModeKey: string;
  defaultInputModeKey: string;
};

/** A player's display name and darts equipment. */
export type PlayerProfile = {
  displayName: string;
  dartsDescription: string | null;
  dartsWeightGrams: number | null;
};

export type AppendBatchResult = {
  created: { stages: number; turns: number; darts: number };
};

export type TrainingStepResolved = {
  sequenceNumber: number;
  exerciseTypeKey: "WARM_UP" | "SWITCHING" | "DOUBLE_PATTERN" | "GAME";
  exerciseRulesetVersionKey: string | null;
  gameTypeKey: string | null;
  durationSeconds: number;
  configuration: Record<string, unknown>;
};

export type StartTrainingResult = {
  activityId: string;
  routineTemplateId: string;
  routineName: string;
  steps: TrainingStepResolved[];
};

export type StartTrainingStepResult = {
  sessionId: string;
  exerciseTypeKey: TrainingStepResolved["exerciseTypeKey"];
  configuration: Record<string, unknown>;
  participant: { ref: string; displayName: string };
  gameTypeKey?: string;
  rulesetVersionKey?: string;
  captureModeKey?: string;
  inputModeKey?: string;
};

/**
 * One seat as it will be persisted: the participant row to insert plus the
 * side it plays for. Built before the write so participants and the
 * configuration snapshot are composed from the same ids in one transaction.
 * `dartbot` is populated only for a `DARTBOT` seat — `buildSeatPlan`
 * (`session.service.ts`) mints it, `composeSeatFacts`
 * (`session-seats.service.ts`) carries it straight into the snapshot's
 * `SeatFact`.
 */
export type SeatPlan = {
  participantId: string;
  participantTypeId: number;
  playerId: string | null;
  displayName: string;
  sideKey: string;
  dartbot?: { level: number; seed: number; levelSource: "MANUAL" };
};

/** Career-wide stat overview — `null` means "not enough data," never "not implemented." */
export type StatisticsOverview = {
  totalGamesPlayed: number;
  totalPlayTimeSeconds: number;
  favoriteGameTypeKey: string | null;
  longestPlayStreakDays: number;
  currentPlayStreakDays: number;
  totalDartsThrown: number;
  hundredPlusCount: number;
  oneTwentyPlusCount: number;
  oneFortyPlusCount: number;
  oneEightiesCount: number;
  medianVisitScore: number;
  highestGameAverage: number;
  firstNineCareerAverage: number;
  scoringAverageExcludingDoubles: number;
  bestLegDarts: number | null;
  averageDartsPerLeg: number | null;
  doubleAccuracy: number | null;
  highestCheckout: { value: number; timesHit: number } | null;
};

export type RoutineStep = {
  sequenceNumber: number;
  exerciseTemplateId: string;
  exerciseName: string;
  exerciseDescription: string | null;
  exerciseTypeKey: string;
  gameTypeKey: string | null;
  durationValue: number;
  durationTypeKey: string;
};

export type RoutineExecution = {
  routineId: string;
  routineName: string;
  description: string | null;
  isSystemTemplate: boolean;
  steps: RoutineStep[];
};

export type RoutineSummary = {
  routineId: string;
  routineName: string;
  description: string | null;
  isSystemTemplate: boolean;
  stepCount: number;
  totalMinutes: number;
};

export type ExerciseTemplateCatalogEntry = {
  exerciseTemplateId: string;
  name: string;
  description: string | null;
  exerciseTypeKey: string;
  gameTypeKey: string | null;
};

export type RoutineWriteInput = {
  name: string;
  description: string | null;
  steps: {
    exerciseTemplateId: string;
    durationTypeKey: "MINUTES";
    durationValue: number;
  }[];
};
