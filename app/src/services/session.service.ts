import { getDb } from "@db/client";
import { generateId } from "@lib/id";
import { getRulesetValidator } from "./rulesets/registry";
import {
  countTurnsForSession,
  findActiveSessions,
  findActiveSessionForGameType,
  findCaptureModeId,
  findConfigurationPresets,
  findConfigurationTemplate,
  findDartZoneIdMap,
  findGameStatusId,
  findGameTypeAndRuleset,
  findIdempotencyRecord,
  findInputModeId,
  findParticipantTypeId,
  findPlayerDisplayName,
  findSessionConfiguration,
  findSessionParticipantIds,
  findSessionRow,
  findStageTypeIdMap,
  insertBatchRecords,
  insertSessionRecords,
  updateSessionStatusRecord,
} from "@repositories/session.repository";
import type {
  CreateSessionRequestInput,
  EventsBatchRequestInput,
  UpdateSessionRequestInput,
} from "@routes/types";
import type {
  AppendBatchResult,
  CreateSessionResult,
  ServiceResult,
} from "./types";

/**
 * True when the error is the uq_sessions_single_active unique violation
 * (Postgres 23505 on that partial index), i.e. an active session for this
 * (player, game type) already exists.
 */
function isActiveSessionConflict(error: unknown): boolean {
  const e = error as { code?: string; constraint?: string; message?: string };
  return (
    e?.code === "23505" &&
    (e?.constraint === "uq_sessions_single_active" ||
      (e?.message?.includes("uq_sessions_single_active") ?? false))
  );
}

export async function createSession(
  playerId: string,
  input: CreateSessionRequestInput,
): Promise<ServiceResult<CreateSessionResult>> {
  const db = getDb();

  const gameTypeRuleset = await findGameTypeAndRuleset(
    db,
    input.gameTypeKey,
    input.rulesetVersionKey,
  );
  if (!gameTypeRuleset) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown gameTypeKey/rulesetVersionKey combination" },
    };
  }

  const validator = getRulesetValidator(input.rulesetVersionKey);
  if (!validator) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "no validator registered for rulesetVersionKey" },
    };
  }

  const [
    captureModeId,
    inputModeId,
    activeStatusId,
    playerParticipantTypeId,
    displayName,
  ] = await Promise.all([
    findCaptureModeId(db, input.captureModeKey),
    findInputModeId(db, input.inputModeKey),
    findGameStatusId(db, "ACTIVE"),
    findParticipantTypeId(db, "PLAYER"),
    findPlayerDisplayName(db, playerId),
  ]);
  if (!captureModeId)
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown captureModeKey" },
    };
  if (!inputModeId)
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown inputModeKey" },
    };
  if (!activeStatusId || !playerParticipantTypeId || !displayName) {
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      details: { reason: "reference data missing" },
    };
  }

  let rawConfig: unknown;
  if (input.config.source === "template") {
    const template = await findConfigurationTemplate(
      db,
      input.config.templateRef,
      gameTypeRuleset.gameTypeId,
      playerId,
    );
    if (!template)
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        details: { reason: "unknown templateRef" },
      };
    rawConfig = {
      ...(template.configuration as Record<string, unknown>),
      ...(input.config.overrides ?? {}),
    };
  } else {
    rawConfig = input.config.config;
  }

  const validated = validator.validateConfig({
    config: rawConfig,
    captureModeKey: input.captureModeKey,
    inputModeKey: input.inputModeKey,
  });
  if (!validated.valid) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { issues: validated.issues },
    };
  }

  const existingActive = await findActiveSessionForGameType(
    db,
    playerId,
    gameTypeRuleset.gameTypeId,
  );
  if (existingActive) {
    return {
      ok: false,
      code: "SESSION_ALREADY_ACTIVE",
      details: {
        sessionId: existingActive.sessionId,
        startedAt: existingActive.startedAt,
      },
    };
  }

  const sessionId = generateId();
  const participantId = generateId();

  try {
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
  } catch (error) {
    if (!isActiveSessionConflict(error)) throw error;
    const active = await findActiveSessionForGameType(
      db,
      playerId,
      gameTypeRuleset.gameTypeId,
    );
    return active
      ? {
          ok: false,
          code: "SESSION_ALREADY_ACTIVE",
          details: {
            sessionId: active.sessionId,
            startedAt: active.startedAt,
          },
        }
      : { ok: false, code: "INTERNAL_ERROR" };
  }

  return {
    ok: true,
    data: {
      sessionId,
      participants: [
        { ref: participantId, participantTypeKey: "PLAYER", displayName },
      ],
    },
  };
}

// fallow-ignore-next-line unused-export -- exported for direct unit testing of canonicalization (idempotency-hash correctness depends on stable key ordering)
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonicalize(v)]),
    );
  }
  return value;
}

export async function hashBatchPayload(
  batch: EventsBatchRequestInput,
): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(batch)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function collectDartZoneKeys(batch: EventsBatchRequestInput): string[] {
  const keys = new Set<string>();
  for (const stage of batch.stages) {
    for (const turn of stage.turns) {
      for (const dart of turn.darts) {
        if (dart.intendedZoneKey) keys.add(dart.intendedZoneKey);
        keys.add(dart.hitZoneKey);
      }
    }
  }
  return [...keys];
}

/**
 * Validates that every stage's parentClientKey and every turn's participantRef
 * resolve to something present in the batch/session.
 */
function validateBatchReferences(
  batch: EventsBatchRequestInput,
  stageIds: Map<string, string>,
  participantIds: string[],
): ServiceResult<void> {
  for (const stage of batch.stages) {
    if (stage.parentClientKey && !stageIds.has(stage.parentClientKey)) {
      return {
        ok: false,
        code: "BATCH_REFERENCE_MISSING",
        details: { clientKey: stage.parentClientKey },
      };
    }
    for (const turn of stage.turns) {
      if (!participantIds.includes(turn.participantRef)) {
        return {
          ok: false,
          code: "BATCH_REFERENCE_MISSING",
          details: { participantRef: turn.participantRef },
        };
      }
    }
  }
  return { ok: true, data: undefined };
}

/** Validates that each stage's turn sequence numbers are positive and unique within the stage. */
function validateBatchOrdering(
  batch: EventsBatchRequestInput,
): ServiceResult<void> {
  for (const stage of batch.stages) {
    const seen = new Set<number>();
    for (const turn of stage.turns) {
      if (turn.sequence <= 0 || seen.has(turn.sequence)) {
        return {
          ok: false,
          code: "BATCH_INCONSISTENT_ORDERING",
          details: { clientKey: turn.clientKey },
        };
      }
      seen.add(turn.sequence);
    }
  }
  return { ok: true, data: undefined };
}

/**
 * Validates structural references and ordering within a batch (parentClientKey
 * resolution, participantRef membership, turn sequence positivity/uniqueness)
 * and resolves each stage's clientKey to a freshly generated stage id.
 */
function resolveBatchStructure(
  batch: EventsBatchRequestInput,
  participantIds: string[],
): ServiceResult<Map<string, string>> {
  const stageIds = new Map<string, string>();
  for (const stage of batch.stages) stageIds.set(stage.clientKey, generateId());

  const references = validateBatchReferences(batch, stageIds, participantIds);
  if (!references.ok) return references;

  const ordering = validateBatchOrdering(batch);
  if (!ordering.ok) return ordering;

  return { ok: true, data: stageIds };
}

/** Resolves stage-type and dart-zone keys referenced by a batch to their lookup ids. */
async function resolveBatchIdMaps(
  db: ReturnType<typeof getDb>,
  batch: EventsBatchRequestInput,
): Promise<
  ServiceResult<{
    stageTypeIdMap: Map<string, number>;
    zoneIdMap: Map<string, number>;
  }>
> {
  const stageTypeIdMap = await findStageTypeIdMap(db);
  const zoneKeys = collectDartZoneKeys(batch);
  const zoneIdMap =
    zoneKeys.length > 0
      ? await findDartZoneIdMap(db)
      : new Map<string, number>();
  const unresolvedZoneKey = zoneKeys.find((k) => !zoneIdMap.has(k));
  if (unresolvedZoneKey) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: `unknown dart zone key: ${unresolvedZoneKey}` },
    };
  }

  const unresolvedStageTypeKey = batch.stages.find(
    (stage) => !stageTypeIdMap.has(stage.stageTypeKey),
  )?.stageTypeKey;
  if (unresolvedStageTypeKey) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: `unknown stageTypeKey: ${unresolvedStageTypeKey}` },
    };
  }

  return { ok: true, data: { stageTypeIdMap, zoneIdMap } };
}

/** Assembles the stage/turn/dart insert-payload arrays from a batch and its resolved id maps. */
function buildBatchInsertPayload(
  batch: EventsBatchRequestInput,
  stageIds: Map<string, string>,
  stageTypeIdMap: Map<string, number>,
  zoneIdMap: Map<string, number>,
) {
  const insertStages = batch.stages.map((stage) => ({
    id: stageIds.get(stage.clientKey)!,
    parentStageId: stage.parentClientKey
      ? stageIds.get(stage.parentClientKey)!
      : null,
    stageTypeId: stageTypeIdMap.get(stage.stageTypeKey)!,
    sequenceNumber: stage.sequence,
  }));

  const insertTurns = batch.stages.flatMap((stage) =>
    stage.turns.map((turn) => ({
      id: generateId(),
      stageId: stageIds.get(stage.clientKey)!,
      participantId: turn.participantRef,
      sequenceNumber: turn.sequence,
      totalScore: turn.totalScore,
      completedAt: turn.completedAt,
      darts: turn.darts.map((dart) => ({
        id: generateId(),
        dartNumber: dart.sequence,
        intendedTargetNumber: dart.intendedTargetNumber,
        intendedZoneId: dart.intendedZoneKey
          ? zoneIdMap.get(dart.intendedZoneKey)!
          : null,
        hitTargetNumber: dart.hitTargetNumber,
        hitZoneId: zoneIdMap.get(dart.hitZoneKey)!,
        score: dart.score,
      })),
    })),
  );

  return { insertStages, insertTurns };
}

export async function appendBatch(
  playerId: string,
  sessionId: string,
  idempotencyKey: string,
  batch: EventsBatchRequestInput,
): Promise<ServiceResult<AppendBatchResult>> {
  const db = getDb();

  const session = await findSessionRow(db, sessionId);
  if (!session) return { ok: false, code: "NOT_FOUND" };
  if (session.playerId !== playerId)
    return { ok: false, code: "SESSION_OWNERSHIP_MISMATCH" };

  const activeStatusId = await findGameStatusId(db, "ACTIVE");
  if (session.statusId !== activeStatusId)
    return { ok: false, code: "SESSION_ALREADY_COMPLETED" };

  const hash = await hashBatchPayload(batch);
  const existingIdempotency = await findIdempotencyRecord(
    db,
    sessionId,
    idempotencyKey,
  );
  if (existingIdempotency) {
    if (existingIdempotency.normalizedPayloadHash !== hash) {
      return {
        ok: false,
        code: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
      };
    }
    return { ok: true, data: existingIdempotency.result as AppendBatchResult };
  }

  const participantIds = await findSessionParticipantIds(db, sessionId);
  const structure = resolveBatchStructure(batch, participantIds);
  if (!structure.ok) return structure;
  const stageIds = structure.data;

  const config = await findSessionConfiguration(db, sessionId);
  const validator = getRulesetValidator(session.rulesetVersionKey);
  if (!validator || !config) return { ok: false, code: "INTERNAL_ERROR" };

  const existingTurnCount = await countTurnsForSession(db, sessionId);
  const batchValidation = validator.validateBatch({
    config,
    batch,
    existingTurnCount,
  });
  if (!batchValidation.valid) {
    return {
      ok: false,
      code: batchValidation.code,
      details: { issues: batchValidation.issues },
    };
  }

  const idMaps = await resolveBatchIdMaps(db, batch);
  if (!idMaps.ok) return idMaps;
  const { stageTypeIdMap, zoneIdMap } = idMaps.data;

  const { insertStages, insertTurns } = buildBatchInsertPayload(
    batch,
    stageIds,
    stageTypeIdMap,
    zoneIdMap,
  );

  const result = await insertBatchRecords({
    sessionId,
    idempotencyRecordId: generateId(),
    idempotencyKey,
    normalizedPayloadHash: hash,
    stages: insertStages,
    turns: insertTurns,
  });

  return { ok: true, data: { created: result } };
}

const TERMINAL_TARGETS = new Set(["COMPLETED", "ABANDONED"]);

export async function updateSessionStatus(
  playerId: string,
  sessionId: string,
  input: UpdateSessionRequestInput,
): Promise<
  ServiceResult<{ sessionId: string; statusKey: string; completedAt: string }>
> {
  const db = getDb();
  const session = await findSessionRow(db, sessionId);
  if (!session) return { ok: false, code: "NOT_FOUND" };
  if (session.playerId !== playerId)
    return { ok: false, code: "SESSION_OWNERSHIP_MISMATCH" };

  if (!TERMINAL_TARGETS.has(input.status)) {
    return {
      ok: false,
      code: "INVALID_STATUS_TRANSITION",
      details: { reason: `unsupported target status ${input.status}` },
    };
  }

  const activeStatusId = await findGameStatusId(db, "ACTIVE");
  if (session.statusId !== activeStatusId) {
    return { ok: false, code: "SESSION_ALREADY_COMPLETED" };
  }

  const targetStatusId = await findGameStatusId(db, input.status);
  if (!targetStatusId) return { ok: false, code: "INTERNAL_ERROR" };

  const completedAt = input.completedAt ?? new Date().toISOString();
  await updateSessionStatusRecord(db, sessionId, targetStatusId, completedAt);

  return {
    ok: true,
    data: { sessionId, statusKey: input.status, completedAt },
  };
}

export async function listActiveSessions(playerId: string) {
  const db = getDb();
  return findActiveSessions(db, playerId);
}

export async function listConfigurationPresets(
  playerId: string,
  gameTypeKey: string,
) {
  const db = getDb();
  return findConfigurationPresets(db, gameTypeKey, playerId);
}
