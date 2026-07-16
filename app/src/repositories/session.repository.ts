import { and, eq, isNull, or, sql } from "drizzle-orm";
import {
  captureModes,
  configurationTemplates,
  dartZones,
  exerciseConfigurations,
  exerciseSessions,
  exerciseStages,
  gameStatuses,
  gameTypes,
  inputModes,
  participantTypes,
  participants,
  players,
  rulesetVersions,
  sessionWriteIdempotency,
  stageTypes,
  turns,
  vActiveSessions,
  vConfigurationPresets,
} from "@db/schema";
import type { getDb } from "@db/client";
import type { ConfigurationTemplateRow, GameTypeRulesetRow, IdempotencyRecord, SessionRow } from "./interfaces";

type Db = ReturnType<typeof getDb>;

export async function findGameTypeAndRuleset(
  db: Db,
  gameTypeKey: string,
  rulesetVersionKey: string,
): Promise<GameTypeRulesetRow | undefined> {
  const [row] = await db
    .select({ gameTypeId: gameTypes.id, rulesetVersionId: rulesetVersions.id })
    .from(gameTypes)
    .innerJoin(rulesetVersions, eq(rulesetVersions.gameTypeId, gameTypes.id))
    .where(
      and(
        eq(gameTypes.implementationKey, gameTypeKey),
        eq(rulesetVersions.implementationKey, rulesetVersionKey),
      ),
    )
    .limit(1);
  return row;
}

export async function findCaptureModeId(db: Db, key: string): Promise<number | undefined> {
  const [row] = await db.select({ id: captureModes.id }).from(captureModes).where(eq(captureModes.implementationKey, key)).limit(1);
  return row?.id;
}

export async function findInputModeId(db: Db, key: string): Promise<number | undefined> {
  const [row] = await db.select({ id: inputModes.id }).from(inputModes).where(eq(inputModes.implementationKey, key)).limit(1);
  return row?.id;
}

export async function findGameStatusId(db: Db, key: string): Promise<number | undefined> {
  const [row] = await db.select({ id: gameStatuses.id }).from(gameStatuses).where(eq(gameStatuses.implementationKey, key)).limit(1);
  return row?.id;
}

export async function findParticipantTypeId(db: Db, key: string): Promise<number | undefined> {
  const [row] = await db
    .select({ id: participantTypes.id })
    .from(participantTypes)
    .where(eq(participantTypes.implementationKey, key))
    .limit(1);
  return row?.id;
}

export async function findStageTypeIdMap(db: Db): Promise<Map<string, number>> {
  const rows = await db.select({ id: stageTypes.id, key: stageTypes.implementationKey }).from(stageTypes);
  return new Map(rows.map((r) => [r.key, r.id]));
}

export async function findDartZoneIdMap(db: Db): Promise<Map<string, number>> {
  const rows = await db.select({ id: dartZones.id, key: dartZones.implementationKey }).from(dartZones);
  return new Map(rows.map((r) => [r.key, r.id]));
}

export async function findPlayerDisplayName(db: Db, playerId: string): Promise<string | undefined> {
  const [row] = await db.select({ displayName: players.displayName }).from(players).where(eq(players.id, playerId)).limit(1);
  return row?.displayName;
}

export async function findConfigurationTemplate(
  db: Db,
  templateId: string,
  gameTypeId: string,
  playerId: string,
): Promise<ConfigurationTemplateRow | undefined> {
  const [row] = await db
    .select({ id: configurationTemplates.id, configuration: configurationTemplates.configuration })
    .from(configurationTemplates)
    .where(
      and(
        eq(configurationTemplates.id, templateId),
        eq(configurationTemplates.gameTypeId, gameTypeId),
        or(isNull(configurationTemplates.playerId), eq(configurationTemplates.playerId, playerId)),
      ),
    )
    .limit(1);
  return row;
}

export async function findSessionRow(db: Db, sessionId: string): Promise<SessionRow | undefined> {
  const [row] = await db
    .select({
      id: exerciseSessions.id,
      playerId: exerciseSessions.playerId,
      statusId: exerciseSessions.statusId,
      rulesetVersionKey: rulesetVersions.implementationKey,
    })
    .from(exerciseSessions)
    .innerJoin(rulesetVersions, eq(rulesetVersions.id, exerciseSessions.rulesetVersionId))
    .where(eq(exerciseSessions.id, sessionId))
    .limit(1);
  return row;
}

export async function findSessionConfiguration(db: Db, sessionId: string): Promise<Record<string, unknown> | undefined> {
  const [row] = await db
    .select({ configuration: exerciseConfigurations.configuration })
    .from(exerciseConfigurations)
    .where(eq(exerciseConfigurations.exerciseSessionId, sessionId))
    .limit(1);
  return row?.configuration as Record<string, unknown> | undefined;
}

export async function findSessionParticipantIds(db: Db, sessionId: string): Promise<string[]> {
  const rows = await db.select({ id: participants.id }).from(participants).where(eq(participants.exerciseSessionId, sessionId));
  return rows.map((r) => r.id);
}

export async function countTurnsForSession(db: Db, sessionId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(turns)
    .innerJoin(exerciseStages, eq(exerciseStages.id, turns.exerciseStageId))
    .where(eq(exerciseStages.exerciseSessionId, sessionId));
  return row?.count ?? 0;
}

export async function findIdempotencyRecord(
  db: Db,
  sessionId: string,
  idempotencyKey: string,
): Promise<IdempotencyRecord | undefined> {
  const [row] = await db
    .select({
      normalizedPayloadHash: sessionWriteIdempotency.normalizedPayloadHash,
      result: sessionWriteIdempotency.result,
    })
    .from(sessionWriteIdempotency)
    .where(and(eq(sessionWriteIdempotency.sessionId, sessionId), eq(sessionWriteIdempotency.idempotencyKey, idempotencyKey)))
    .limit(1);
  return row;
}

export async function findActiveSessions(db: Db, playerId: string) {
  return db.select().from(vActiveSessions).where(eq(vActiveSessions.playerId, playerId));
}

export async function findConfigurationPresets(db: Db, gameTypeKey: string, playerId: string) {
  return db
    .select()
    .from(vConfigurationPresets)
    .where(
      and(
        eq(vConfigurationPresets.gameTypeKey, gameTypeKey),
        or(isNull(vConfigurationPresets.playerId), eq(vConfigurationPresets.playerId, playerId)),
      ),
    );
}
