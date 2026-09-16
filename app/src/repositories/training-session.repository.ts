import { and, eq } from "drizzle-orm";
import { getDb, withTransaction } from "@db/client";
import {
  activities,
  activityConfigurations,
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
        exerciseRulesetVersions.exerciseTypeId,
        exerciseTemplates.exerciseTypeId,
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

export async function insertTrainingActivity(input: {
  activityId: string;
  playerId: string;
  activeStatusId: number;
  configurationId: string;
  configuration: unknown;
}): Promise<void> {
  await withTransaction(async (tx) => {
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
  });
}
