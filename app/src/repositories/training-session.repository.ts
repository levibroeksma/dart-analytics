import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb, withTransaction } from "@db/client";
import {
  activities,
  activityConfigurations,
  exerciseSessions,
  vRoutineExecution,
  vTrainingCompletions,
} from "@db/schema";
import { nonNull } from "./row-helpers";
import type {
  RoutineStepTemplateRow,
  TrainingCompletionRow,
} from "./interfaces";

type Db = ReturnType<typeof getDb>;

type Tx = Parameters<typeof withTransaction>[0] extends (tx: infer T) => unknown
  ? T
  : never;

/**
 * A routine's ordered steps through `v_routine_execution`, visible when the
 * routine is a system routine or the caller's own (D321). A stepless routine
 * reads as no routine; `startTraining` answers `VALIDATION_FAILED`.
 */
export async function findRoutineTemplateSteps(
  db: Db,
  routineTemplateId: string,
  playerId: string,
): Promise<
  | {
      routineTemplateId: string;
      routineName: string;
      steps: RoutineStepTemplateRow[];
    }
  | undefined
> {
  const rows = await db
    .select({
      routineTemplateId: vRoutineExecution.routineId,
      routineName: vRoutineExecution.routineName,
      sequenceNumber: vRoutineExecution.sequenceNumber,
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
      and(
        eq(vRoutineExecution.routineId, routineTemplateId),
        or(
          eq(vRoutineExecution.isSystemTemplate, true),
          eq(vRoutineExecution.playerId, playerId),
        ),
      ),
    )
    .orderBy(vRoutineExecution.sequenceNumber);

  const first = rows[0];
  if (!first) return undefined;

  return {
    routineTemplateId: nonNull(first.routineTemplateId, "routine_id"),
    routineName: nonNull(first.routineName, "routine_name"),
    steps: rows.map((row) => ({
      sequenceNumber: nonNull(row.sequenceNumber, "sequence_number"),
      exerciseTypeKey: nonNull(row.exerciseTypeKey, "exercise_type_key"),
      exerciseRulesetVersionKey: row.exerciseRulesetVersionKey,
      gameTypeKey: row.gameTypeKey,
      gameRulesetVersionKey: row.gameRulesetVersionKey,
      durationTypeKey: nonNull(row.durationTypeKey, "duration_type_key"),
      durationValue: nonNull(row.durationValue, "duration_value"),
      defaultConfiguration: row.defaultConfiguration,
      stepConfiguration: row.stepConfiguration,
    })),
  };
}

/**
 * The activity's configuration snapshot, visible only to the player who owns
 * the activity — an unowned or unknown `activityId` reads as `undefined`
 * (`06-API/02-Middleware-And-Layering.md` Rules #5).
 */
export async function findActivityConfiguration(
  db: Db,
  activityId: string,
  playerId: string,
): Promise<{ routineName: string; steps: unknown[] } | undefined> {
  const [row] = await db
    .select({ configuration: activityConfigurations.configuration })
    .from(activityConfigurations)
    .innerJoin(activities, eq(activities.id, activityConfigurations.activityId))
    .where(
      and(
        eq(activityConfigurations.activityId, activityId),
        eq(activities.playerId, playerId),
      ),
    )
    .limit(1);
  return row?.configuration as
    { routineName: string; steps: unknown[] } | undefined;
}

/** The activity's current status, scoped to the player who owns it. */
export async function findActivityStatus(
  db: Db,
  activityId: string,
  playerId: string,
): Promise<{ statusId: number } | undefined> {
  const [row] = await db
    .select({ statusId: activities.statusId })
    .from(activities)
    .where(
      and(eq(activities.id, activityId), eq(activities.playerId, playerId)),
    )
    .limit(1);
  return row;
}

/**
 * Moves an activity to a terminal status. `expectedStatusId` is part of the
 * UPDATE predicate, so a row that already left that status matches nothing and
 * keeps its original `completed_at`; no row returned means "not owned, unknown,
 * or no longer in the expected status".
 */
export async function updateActivityStatusRecord(
  db: Db,
  input: {
    activityId: string;
    playerId: string;
    statusId: number;
    expectedStatusId: number;
  },
): Promise<{ activityId: string; completedAt: string } | undefined> {
  const now = new Date().toISOString();
  const [row] = await db
    .update(activities)
    .set({ statusId: input.statusId, completedAt: now })
    .where(
      and(
        eq(activities.id, input.activityId),
        eq(activities.playerId, input.playerId),
        eq(activities.statusId, input.expectedStatusId),
      ),
    )
    .returning({
      activityId: activities.id,
      completedAt: activities.completedAt,
    });
  return row as { activityId: string; completedAt: string } | undefined;
}

/**
 * Closes every training activity the player still has open, and with it any
 * step session left running under one. A training activity is the one carrying
 * an `activity_configurations` snapshot, which is what separates it from the
 * activity a standalone game creates. Returns the closed activity ids.
 *
 * The snapshot predicate is a raw `sql` EXISTS rather than drizzle's `exists()`
 * helper: that helper parenthesises a subquery builder but emits a raw chunk
 * verbatim, which Postgres rejects as a syntax error.
 */
export async function abandonActiveTrainingActivities(
  tx: Tx,
  input: { playerId: string; abandonedStatusId: number },
): Promise<string[]> {
  const now = new Date().toISOString();
  const closed = await tx
    .update(activities)
    .set({ statusId: input.abandonedStatusId, completedAt: now })
    .where(
      and(
        eq(activities.playerId, input.playerId),
        isNull(activities.completedAt),
        sql`exists (select 1 from ${activityConfigurations} where ${activityConfigurations.activityId} = ${activities.id})`,
      ),
    )
    .returning({ activityId: activities.id });

  const activityIds = closed.map((row) => row.activityId as string);
  if (activityIds.length === 0) return [];

  await tx
    .update(exerciseSessions)
    .set({ statusId: input.abandonedStatusId, completedAt: now })
    .where(
      and(
        inArray(exerciseSessions.activityId, activityIds),
        isNull(exerciseSessions.completedAt),
      ),
    )
    .returning({ sessionId: exerciseSessions.id });

  return activityIds;
}

export async function insertTrainingActivity(
  tx: Tx,
  input: {
    activityId: string;
    playerId: string;
    activeStatusId: number;
    configurationId: string;
    configuration: unknown;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await tx.insert(activities).values({
    id: input.activityId,
    playerId: input.playerId,
    statusId: input.activeStatusId,
    startedAt: now,
    createdAt: now,
  });
  await tx.insert(activityConfigurations).values({
    id: input.configurationId,
    activityId: input.activityId,
    configuration: input.configuration,
    createdAt: now,
  });
}

/**
 * The caller's completed trainings with `completed_at` at or after `since`,
 * newest first, through `v_training_completions` (0042).
 */
export async function findTrainingCompletions(
  db: Db,
  playerId: string,
  since: string,
): Promise<TrainingCompletionRow[]> {
  const rows = await db
    .select({
      activityId: vTrainingCompletions.activityId,
      routineTemplateId: vTrainingCompletions.routineTemplateId,
      routineName: vTrainingCompletions.routineName,
      completedAt: vTrainingCompletions.completedAt,
    })
    .from(vTrainingCompletions)
    .where(
      and(
        eq(vTrainingCompletions.playerId, playerId),
        gte(vTrainingCompletions.completedAt, since),
      ),
    )
    .orderBy(desc(vTrainingCompletions.completedAt));
  return rows.map((row) => ({
    activityId: nonNull(row.activityId, "activity_id"),
    routineTemplateId: nonNull(row.routineTemplateId, "routine_template_id"),
    routineName: nonNull(row.routineName, "routine_name"),
    completedAt: nonNull(row.completedAt, "completed_at"),
  }));
}
