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
