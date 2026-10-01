import { and, desc, eq, gte, isNull, or } from "drizzle-orm";
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
): Promise<
  | { routineTemplateId: string; routineName: string; steps: unknown[] }
  | undefined
> {
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
    | { routineTemplateId: string; routineName: string; steps: unknown[] }
    | undefined;
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
  db: Db | Tx,
  input: {
    activityId: string;
    playerId: string;
    statusId: number;
    expectedStatusId: number;
  },
): Promise<{ activityId: string; completedAt: string } | undefined> {
  const executor = db as Db;
  const now = new Date().toISOString();
  const [row] = await executor
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
 * The player's newest training activity that is still open. A training
 * activity is the one carrying an `activity_configurations` snapshot, which is
 * what separates it from the activity a standalone game creates.
 */
export async function findOpenTrainingActivity(
  db: Db | Tx,
  playerId: string,
): Promise<
  { activityId: string; startedAt: string; routineName: string } | undefined
> {
  const [row] = await (db as Db)
    .select({
      activityId: activities.id,
      startedAt: activities.startedAt,
      configuration: activityConfigurations.configuration,
    })
    .from(activities)
    .innerJoin(
      activityConfigurations,
      eq(activityConfigurations.activityId, activities.id),
    )
    .where(
      and(eq(activities.playerId, playerId), isNull(activities.completedAt)),
    )
    .orderBy(desc(activities.startedAt))
    .limit(1);
  if (!row) return undefined;
  const snapshot = row.configuration as { routineName?: string } | null;
  return {
    activityId: row.activityId as string,
    startedAt: row.startedAt as string,
    routineName: snapshot?.routineName ?? "",
  };
}

/** Abandons every step session still open under the activity. */
export async function closeOpenStepSessions(
  tx: Tx,
  input: { activityId: string; abandonedStatusId: number },
): Promise<void> {
  await tx
    .update(exerciseSessions)
    .set({
      statusId: input.abandonedStatusId,
      completedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(exerciseSessions.activityId, input.activityId),
        isNull(exerciseSessions.completedAt),
      ),
    )
    .returning({ sessionId: exerciseSessions.id });
}

/** The routine step sequence numbers whose session finished `COMPLETED`. */
export async function findCompletedStepSequenceNumbers(
  db: Db,
  input: { activityId: string; completedStatusId: number },
): Promise<number[]> {
  const rows = await db
    .select({ sequenceNumber: exerciseSessions.routineStepSequenceNumber })
    .from(exerciseSessions)
    .where(
      and(
        eq(exerciseSessions.activityId, input.activityId),
        eq(exerciseSessions.statusId, input.completedStatusId),
      ),
    );
  return rows.flatMap((row) =>
    row.sequenceNumber === null ? [] : [row.sequenceNumber],
  );
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
