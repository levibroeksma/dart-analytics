import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, withTransaction } from "@db/client";
import {
  activities,
  activityConfigurations,
  exerciseSessions,
  durationTypes,
  exerciseRulesetVersions,
  exerciseTemplates,
  exerciseTypes,
  gameTypes,
  routineSteps,
  routineTemplates,
} from "@db/schema";
import type { RoutineStepTemplateRow } from "./interfaces";

type Db = ReturnType<typeof getDb>;

type Tx = Parameters<typeof withTransaction>[0] extends (tx: infer T) => unknown
  ? T
  : never;

export async function findRoutineTemplateSteps(
  db: Db,
  routineTemplateName: string,
): Promise<
  { routineTemplateId: string; steps: RoutineStepTemplateRow[] } | undefined
> {
  const [template] = await db
    .select({ id: routineTemplates.id })
    .from(routineTemplates)
    .where(
      and(
        eq(routineTemplates.name, routineTemplateName),
        eq(routineTemplates.isSystemTemplate, true),
      ),
    )
    .limit(1);
  if (!template) return undefined;

  const steps = await db
    .select({
      sequenceNumber: routineSteps.sequenceNumber,
      exerciseTypeKey: exerciseTypes.implementationKey,
      exerciseRulesetVersionKey: exerciseRulesetVersions.implementationKey,
      gameTypeKey: gameTypes.implementationKey,
      durationTypeKey: durationTypes.implementationKey,
      durationValue: routineSteps.durationValue,
      defaultConfiguration: exerciseTemplates.defaultConfiguration,
      stepConfiguration: routineSteps.configuration,
    })
    .from(routineSteps)
    .innerJoin(
      exerciseTemplates,
      eq(exerciseTemplates.id, routineSteps.exerciseTemplateId),
    )
    .innerJoin(
      exerciseTypes,
      eq(exerciseTypes.id, exerciseTemplates.exerciseTypeId),
    )
    .innerJoin(durationTypes, eq(durationTypes.id, routineSteps.durationTypeId))
    .leftJoin(gameTypes, eq(gameTypes.id, exerciseTemplates.gameTypeId))
    .leftJoin(
      exerciseRulesetVersions,
      eq(
        exerciseRulesetVersions.id,
        exerciseTemplates.exerciseRulesetVersionId,
      ),
    )
    .where(eq(routineSteps.routineTemplateId, template.id))
    .orderBy(routineSteps.sequenceNumber);

  return { routineTemplateId: template.id, steps };
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
