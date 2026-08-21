export interface ProvisionedPlayer {
  playerId: string;
  authUserId: string;
  created: boolean;
}

export interface GameTypeRulesetRow {
  gameTypeId: string;
  rulesetVersionId: string;
}

export interface ConfigurationTemplateRow {
  id: string;
  configuration: unknown;
}

export interface SessionRow {
  id: string;
  playerId: string;
  statusId: number;
  rulesetVersionKey: string;
  captureModeKey: string;
  inputModeKey: string;
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
  gameTypeId: string;
  rulesetVersionId: string;
  captureModeId: number;
  inputModeId: number;
  activeStatusId: number;
  configuration: Record<string, unknown>;
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
