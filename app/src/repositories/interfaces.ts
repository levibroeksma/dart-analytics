export interface ProvisionedPlayer {
  playerId: string;
  authUserId: string;
  created: boolean;
}

/**
 * Turns already persisted for a session, grouped by participant id — the
 * same id a batch turn's `participantRef` carries (see
 * `resolveBatchStructure`/`validateBatchReferences` in `session.service.ts`).
 * A participant absent from this map has zero existing turns.
 */
export type ExistingTurnCounts = Record<string, number>;

export interface GameTypeRulesetRow {
  gameTypeId: string;
  rulesetVersionId: string;
}

export interface ConfigurationTemplateRow {
  id: string;
  configuration: unknown;
}

/**
 * A non-GAME exercise session (training's WARM_UP/SWITCHING/DOUBLE_PATTERN
 * steps) has no game ruleset/capture/input mode, so these three are absent
 * rather than always present (D264).
 */
export interface SessionRow {
  id: string;
  playerId: string;
  statusId: number;
  rulesetVersionKey: string | null;
  exerciseRulesetVersionKey: string | null;
  captureModeKey: string | null;
  inputModeKey: string | null;
}

export interface IdempotencyRecord {
  normalizedPayloadHash: string;
  result: unknown;
}

/**
 * One session's rows, written in a single transaction.
 *
 * `participants` is every seat's participant row, in seat order. One entry
 * reproduces the single-PLAYER session this used to take four separate fields
 * for; several are what lets one session hold a guest alongside its owner.
 */
export interface CreateSessionRecordsInput {
  activityId: string;
  sessionId: string;
  configurationId: string;
  participants: {
    id: string;
    participantTypeId: number;
    playerId: string | null;
    displayName: string;
  }[];
  playerId: string;
  gameTypeId?: string;
  rulesetVersionId?: string;
  captureModeId?: number;
  inputModeId?: number;
  activeStatusId: number;
  exerciseTypeId: string;
  exerciseRulesetVersionId?: string;
  routineStepSequenceNumber?: number;
  configuration: Record<string, unknown>;
}

export interface RoutineStepTemplateRow {
  sequenceNumber: number;
  exerciseTypeKey: string;
  exerciseRulesetVersionKey: string | null;
  gameTypeKey: string | null;
  gameRulesetVersionKey: string | null;
  durationTypeKey: string;
  durationValue: number;
  defaultConfiguration: unknown;
  stepConfiguration: unknown;
}

export interface BatchInsertStage {
  id: string;
  parentStageId: string | null;
  stageTypeId: number;
  sequenceNumber: number;
}

export interface BatchInsertDart {
  id: string;
  dartNumber: number;
  intendedTargetNumber: number | null;
  intendedZoneId: number | null;
  hitTargetNumber: number | null;
  hitZoneId: number;
  score: number;
  locationX: number | null;
  locationY: number | null;
}

export interface BatchInsertTurn {
  id: string;
  stageId: string;
  participantId: string;
  sequenceNumber: number;
  totalScore: number;
  completedAt: string | null;
  darts: BatchInsertDart[];
}

export interface BatchInsertInput {
  sessionId: string;
  idempotencyRecordId: string;
  idempotencyKey: string;
  normalizedPayloadHash: string;
  stages: BatchInsertStage[];
  turns: BatchInsertTurn[];
}

export interface ActiveSessionSummary {
  sessionId: string;
  startedAt: string;
}

/**
 * A `v_player_settings` row. Both keys are nullable: the view LEFT JOINs the
 * lookup tables, and `player_settings` allows either mode column to be unset.
 */
export interface PlayerSettingsRow {
  defaultCaptureModeKey: string | null;
  defaultInputModeKey: string | null;
}

/** Mode keys to store on a player's settings row. */
export interface PlayerSettingsInput {
  defaultCaptureModeKey: string;
  defaultInputModeKey: string;
}

/** A `v_player_profile` row. */
export interface PlayerProfileRow {
  displayName: string;
  dartsDescription: string | null;
  dartsWeightGrams: number | null;
}

/** Profile fields to store on a player's row. */
export interface PlayerProfileInput {
  displayName: string;
  dartsDescription: string | null;
  dartsWeightGrams: number | null;
}

/** One `v_routine_execution` row — a step of a routine the caller may see. */
export interface RoutineExecutionRow {
  routineId: string;
  routineName: string;
  routineDescription: string | null;
  isSystemTemplate: boolean;
  playerId: string | null;
  sequenceNumber: number;
  exerciseTemplateId: string;
  exerciseName: string;
  exerciseDescription: string | null;
  exerciseTypeKey: string;
  exerciseRulesetVersionKey: string | null;
  gameTypeKey: string | null;
  gameRulesetVersionKey: string | null;
  durationTypeKey: string;
  durationValue: number;
  defaultConfiguration: unknown;
  stepConfiguration: unknown;
}

/** One `v_exercise_template_catalog` row. */
export interface ExerciseTemplateCatalogRow {
  exerciseTemplateId: string;
  name: string;
  description: string | null;
  exerciseTypeKey: string;
  gameTypeKey: string | null;
  gameRulesetVersionKey: string | null;
  hasDefaultConfiguration: boolean;
}

/** One `v_training_schedules` row — a schedule with its day count. */
export interface TrainingScheduleRow {
  scheduleId: string;
  playerId: string;
  name: string;
  isActive: boolean;
  updatedAt: string;
  dayCount: number;
}

/** One `v_training_schedule_days` row — a single (schedule, weekday) assignment. */
export interface TrainingScheduleDayRow {
  scheduleId: string;
  playerId: string;
  scheduleName: string;
  isActive: boolean;
  dayOfWeek: number;
  routineTemplateId: string;
  routineName: string;
  routineMinutes: number;
}

/** One `v_training_completions` row — a completed training and the routine it ran. */
export interface TrainingCompletionRow {
  activityId: string;
  routineTemplateId: string;
  routineName: string;
  completedAt: string;
}
