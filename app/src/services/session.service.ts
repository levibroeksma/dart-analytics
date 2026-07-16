import { getDb } from "@db/client";
import { generateId } from "@lib/id";
import { getRulesetValidator } from "./rulesets/registry";
import {
  findCaptureModeId,
  findConfigurationTemplate,
  findGameStatusId,
  findGameTypeAndRuleset,
  findInputModeId,
  findParticipantTypeId,
  findPlayerDisplayName,
  insertSessionRecords,
} from "@repositories/session.repository";
import type { CreateSessionRequestInput } from "@routes/types";
import type { ErrorCode } from "@server/errors";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; details?: Record<string, unknown> };

export type CreateSessionResult = {
  sessionId: string;
  participants: { ref: string; participantTypeKey: string; displayName: string }[];
};

export async function createSession(
  playerId: string,
  input: CreateSessionRequestInput,
): Promise<ServiceResult<CreateSessionResult>> {
  const db = getDb();

  const gameTypeRuleset = await findGameTypeAndRuleset(db, input.gameTypeKey, input.rulesetVersionKey);
  if (!gameTypeRuleset) {
    return { ok: false, code: "VALIDATION_FAILED", details: { reason: "unknown gameTypeKey/rulesetVersionKey combination" } };
  }

  const validator = getRulesetValidator(input.rulesetVersionKey);
  if (!validator) {
    return { ok: false, code: "VALIDATION_FAILED", details: { reason: "no validator registered for rulesetVersionKey" } };
  }

  const [captureModeId, inputModeId, activeStatusId, playerParticipantTypeId, displayName] = await Promise.all([
    findCaptureModeId(db, input.captureModeKey),
    findInputModeId(db, input.inputModeKey),
    findGameStatusId(db, "ACTIVE"),
    findParticipantTypeId(db, "PLAYER"),
    findPlayerDisplayName(db, playerId),
  ]);
  if (!captureModeId) return { ok: false, code: "VALIDATION_FAILED", details: { reason: "unknown captureModeKey" } };
  if (!inputModeId) return { ok: false, code: "VALIDATION_FAILED", details: { reason: "unknown inputModeKey" } };
  if (!activeStatusId || !playerParticipantTypeId || !displayName) {
    return { ok: false, code: "INTERNAL_ERROR", details: { reason: "reference data missing" } };
  }

  let rawConfig: unknown;
  if (input.config.source === "template") {
    const template = await findConfigurationTemplate(db, input.config.templateRef, gameTypeRuleset.gameTypeId, playerId);
    if (!template) return { ok: false, code: "VALIDATION_FAILED", details: { reason: "unknown templateRef" } };
    rawConfig = { ...(template.configuration as Record<string, unknown>), ...(input.config.overrides ?? {}) };
  } else {
    rawConfig = input.config.config;
  }

  const validated = validator.validateConfig({
    config: rawConfig,
    captureModeKey: input.captureModeKey,
    inputModeKey: input.inputModeKey,
  });
  if (!validated.valid) {
    return { ok: false, code: "VALIDATION_FAILED", details: { issues: validated.issues } };
  }

  const sessionId = generateId();
  const participantId = generateId();

  await insertSessionRecords({
    activityId: generateId(),
    sessionId,
    configurationId: generateId(),
    participantId,
    playerId,
    gameTypeId: gameTypeRuleset.gameTypeId,
    rulesetVersionId: gameTypeRuleset.rulesetVersionId,
    captureModeId,
    inputModeId,
    activeStatusId,
    playerParticipantTypeId,
    displayName,
    configuration: validated.config,
  });

  return {
    ok: true,
    data: { sessionId, participants: [{ ref: participantId, participantTypeKey: "PLAYER", displayName }] },
  };
}
