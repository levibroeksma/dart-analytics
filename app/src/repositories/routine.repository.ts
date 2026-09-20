import { and, asc, desc, eq, or } from "drizzle-orm";
import { getDb, withTransaction } from "@db/client";
import {
  durationTypes,
  routineSteps,
  routineTemplates,
  vExerciseTemplateCatalog,
  vRoutineExecution,
} from "@db/schema";
import type {
  ExerciseTemplateCatalogRow,
  RoutineExecutionRow,
} from "./interfaces";
import { viewRows } from "./view-rows";

type Db = ReturnType<typeof getDb>;

type Tx = Parameters<typeof withTransaction>[0] extends (tx: infer T) => unknown
  ? T
  : never;

/**
 * The routines a player may read: every system routine plus their own
 * (`06-API/04-Endpoint-Contracts.md`, D321). A stepless routine has no rows
 * in the view and so reads as absent, which for a user routine the `0038`
 * trigger makes impossible.
 */
export async function findRoutineExecutionRows(
  db: Db,
  playerId: string,
  routineId?: string,
): Promise<RoutineExecutionRow[]> {
  const scope = or(
    eq(vRoutineExecution.isSystemTemplate, true),
    eq(vRoutineExecution.playerId, playerId),
  );
  const rows = await db
    .select({
      routineId: vRoutineExecution.routineId,
      routineName: vRoutineExecution.routineName,
      routineDescription: vRoutineExecution.routineDescription,
      isSystemTemplate: vRoutineExecution.isSystemTemplate,
      playerId: vRoutineExecution.playerId,
      sequenceNumber: vRoutineExecution.sequenceNumber,
      exerciseTemplateId: vRoutineExecution.exerciseTemplateId,
      exerciseName: vRoutineExecution.exerciseName,
      exerciseDescription: vRoutineExecution.exerciseDescription,
      exerciseTypeKey: vRoutineExecution.exerciseTypeKey,
      exerciseRulesetVersionKey: vRoutineExecution.exerciseRulesetVersionKey,
      gameTypeKey: vRoutineExecution.gameTypeKey,
      gameRulesetVersionKey: vRoutineExecution.gameRulesetVersionKey,
      durationTypeKey: vRoutineExecution.durationTypeKey,
      durationValue: vRoutineExecution.durationValue,
      defaultConfiguration: vRoutineExecution.defaultConfiguration,
      stepConfiguration: vRoutineExecution.stepConfiguration,
    })
    .from(vRoutineExecution)
    .where(
      routineId
        ? and(eq(vRoutineExecution.routineId, routineId), scope)
        : scope,
    )
    .orderBy(
      desc(vRoutineExecution.isSystemTemplate),
      asc(vRoutineExecution.routineName),
      asc(vRoutineExecution.routineId),
      asc(vRoutineExecution.sequenceNumber),
    );
  return viewRows<RoutineExecutionRow>(rows);
}

/** Every published system exercise template — narrowed by the caller, not here. */
export async function findExerciseTemplateCatalog(
  db: Db,
): Promise<ExerciseTemplateCatalogRow[]> {
  const rows = await db
    .select({
      exerciseTemplateId: vExerciseTemplateCatalog.exerciseTemplateId,
      name: vExerciseTemplateCatalog.name,
      description: vExerciseTemplateCatalog.description,
      exerciseTypeKey: vExerciseTemplateCatalog.exerciseTypeKey,
      gameTypeKey: vExerciseTemplateCatalog.gameTypeKey,
      gameRulesetVersionKey: vExerciseTemplateCatalog.gameRulesetVersionKey,
      hasDefaultConfiguration: vExerciseTemplateCatalog.hasDefaultConfiguration,
    })
    .from(vExerciseTemplateCatalog)
    .orderBy(asc(vExerciseTemplateCatalog.name));
  return viewRows<ExerciseTemplateCatalogRow>(rows);
}

export async function findDurationTypeId(
  db: Db,
  implementationKey: string,
): Promise<number | undefined> {
  const [row] = await db
    .select({ id: durationTypes.id })
    .from(durationTypes)
    .where(eq(durationTypes.implementationKey, implementationKey))
    .limit(1);
  return row?.id;
}

export async function insertRoutineTemplateRecord(
  tx: Tx,
  input: {
    routineId: string;
    playerId: string;
    name: string;
    description: string | null;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await tx.insert(routineTemplates).values({
    id: input.routineId,
    playerId: input.playerId,
    name: input.name,
    description: input.description,
    isSystemTemplate: false,
    createdAt: now,
    updatedAt: now,
  });
}

/** `sequence_number` is array position + 1 — never taken from a request. */
export async function insertRoutineStepRecords(
  tx: Tx,
  input: {
    routineId: string;
    durationTypeId: number;
    steps: { id: string; exerciseTemplateId: string; durationValue: number }[];
  },
): Promise<void> {
  const now = new Date().toISOString();
  await tx.insert(routineSteps).values(
    input.steps.map((step, index) => ({
      id: step.id,
      routineTemplateId: input.routineId,
      exerciseTemplateId: step.exerciseTemplateId,
      sequenceNumber: index + 1,
      durationTypeId: input.durationTypeId,
      durationValue: step.durationValue,
      configuration: null,
      createdAt: now,
    })),
  );
}

/** True when the caller's own non-system routine was updated. */
export async function updateRoutineTemplateRecord(
  tx: Tx,
  input: {
    routineId: string;
    playerId: string;
    name: string;
    description: string | null;
  },
): Promise<boolean> {
  const rows = await tx
    .update(routineTemplates)
    .set({
      name: input.name,
      description: input.description,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(routineTemplates.id, input.routineId),
        eq(routineTemplates.playerId, input.playerId),
        eq(routineTemplates.isSystemTemplate, false),
      ),
    )
    .returning({ id: routineTemplates.id });
  return rows.length === 1;
}

export async function deleteRoutineStepRecords(
  tx: Tx,
  routineId: string,
): Promise<void> {
  await tx
    .delete(routineSteps)
    .where(eq(routineSteps.routineTemplateId, routineId));
}

/** Steps cascade (`fk_routine_steps_routine`). True when a row was deleted. */
export async function deleteRoutineTemplateRecord(
  db: Db,
  routineId: string,
  playerId: string,
): Promise<boolean> {
  const rows = await db
    .delete(routineTemplates)
    .where(
      and(
        eq(routineTemplates.id, routineId),
        eq(routineTemplates.playerId, playerId),
        eq(routineTemplates.isSystemTemplate, false),
      ),
    )
    .returning({ id: routineTemplates.id });
  return rows.length === 1;
}
