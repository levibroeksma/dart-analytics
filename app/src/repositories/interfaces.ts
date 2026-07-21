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
}

export interface IdempotencyRecord {
  normalizedPayloadHash: string;
  result: unknown;
}

export interface CreateSessionRecordsInput {
  activityId: string;
  sessionId: string;
  configurationId: string;
  participantId: string;
  playerId: string;
  gameTypeId: string;
  rulesetVersionId: string;
  captureModeId: number;
  inputModeId: number;
  activeStatusId: number;
  playerParticipantTypeId: number;
  displayName: string;
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
