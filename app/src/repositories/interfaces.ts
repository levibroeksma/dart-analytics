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
