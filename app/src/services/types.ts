import type { ErrorCode } from "@server/types";
import type {
  CompletionSeriesResponseData,
  ConfusionSeriesResponseData,
  GameSessionListResponseData,
  GroupingSeriesResponseData,
  HeatmapSeriesResponseData,
  LooseDartsSeriesResponseData,
  MissDirectionSeriesResponseData,
  SessionResultSeriesResponseData,
  TargetAccuracySeriesResponseData,
  VolumeSeriesResponseData,
} from "@routes/types";
import type {
  ReplayParticipantRow,
  ReplaySessionRow,
  ReplayStageRow,
  ReplayTurn,
} from "@modules/types";

export * from "./exercise-rulesets/types";
export * from "./rulesets/types";
export * from "./routines/types";

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
  exerciseTypeKey:
    | "WARM_UP"
    | "SWITCHING"
    | "DOUBLE_PATTERN"
    | "TARGET_SCORING"
    | "SWITCHING_TARGET_SCORING"
    | "SCORE_THRESHOLD"
    | "BULLSEYE_CHECKOUT"
    | "BULL_UP"
    | "GAME";
  exerciseRulesetVersionKey: string | null;
  gameTypeKey: string | null;
  gameRulesetVersionKey: string | null;
  durationSeconds: number;
  configuration: Record<string, unknown>;
};

export type StartTrainingResult = {
  activityId: string;
  routineTemplateId: string;
  routineName: string;
  steps: TrainingStepResolved[];
};

/** A completed training and the routine it ran. */
export type TrainingCompletion = {
  activityId: string;
  routineTemplateId: string;
  routineName: string;
  completedAt: string;
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
  checkoutPercentage: number | null;
  highestCheckout: { value: number; timesHit: number } | null;
};

export type GameSessionList = GameSessionListResponseData;

export type SeriesResponse =
  | CompletionSeriesResponseData
  | VolumeSeriesResponseData
  | SessionResultSeriesResponseData
  | TargetAccuracySeriesResponseData
  | ConfusionSeriesResponseData
  | GroupingSeriesResponseData
  | MissDirectionSeriesResponseData
  | LooseDartsSeriesResponseData
  | HeatmapSeriesResponseData;

/**
 * A replay page's header (D371 decision 5): the session's own stored facts
 * (`ReplaySessionRow`) plus its participants and stage tree, both ordered by
 * play order. Never carries a derived outcome -- the client folds one from
 * the turns (decision 8).
 */
export type ReplayHeader = ReplaySessionRow & {
  participants: ReplayParticipantRow[];
  stages: ReplayStageRow[];
};

/**
 * One page of a session's replay (D371 decisions 2, 4-5): whole turns in
 * play order. `header` is present only on the first page (`cursor: null`) --
 * every later page carries `header: null`, since a page is cached forever
 * and the header would only repeat. `nextCursor` is `null` once the
 * session's last turn has been paged.
 */
export type ReplayPage = {
  header: ReplayHeader | null;
  turns: ReplayTurn[];
  nextCursor: string | null;
};

export type RoutineStep = {
  sequenceNumber: number;
  exerciseTemplateId: string;
  exerciseName: string;
  exerciseDescription: string | null;
  exerciseTypeKey: string;
  gameTypeKey: string | null;
  gameRulesetVersionKey: string | null;
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
  gameRulesetVersionKey: string | null;
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

/** One weekday's assignment within a schedule; a weekday absent from `days` is rest. */
export type ScheduleDay = {
  dayOfWeek: number;
  routineId: string;
  routineName: string;
  routineMinutes: number;
};

export type Schedule = {
  scheduleId: string;
  name: string;
  isActive: boolean;
  days: ScheduleDay[];
};

export type ScheduleSummary = {
  scheduleId: string;
  name: string;
  isActive: boolean;
  dayCount: number;
};

export type ScheduleWriteInput = {
  name: string;
  days: { dayOfWeek: number; routineTemplateId: string }[];
};
