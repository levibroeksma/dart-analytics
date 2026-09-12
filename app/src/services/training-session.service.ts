import { generateId } from "@lib/id";
import { getDb } from "@db/client";
import { findGameStatusId } from "@repositories/session.repository";
import {
  findRoutineTemplateSteps,
  insertTrainingActivity,
} from "@repositories/training-session.repository";
import type { RoutineStepTemplateRow } from "@repositories/interfaces";
import type {
  ServiceResult,
  StartTrainingResult,
  TrainingStepResolved,
} from "./types";

function durationSecondsFor(
  durationTypeKey: string,
  durationValue: number,
): number {
  return durationTypeKey === "MINUTES" ? durationValue * 60 : durationValue;
}

function resolveStep(row: RoutineStepTemplateRow): TrainingStepResolved {
  const durationSeconds = durationSecondsFor(
    row.durationTypeKey,
    row.durationValue,
  );
  const configuration: Record<string, unknown> = {
    ...(row.defaultConfiguration as Record<string, unknown> | null),
    ...(row.stepConfiguration as Record<string, unknown> | null),
  };
  if (row.exerciseTypeKey === "WARM_UP") {
    configuration.stepDurationSeconds = durationSeconds;
  }
  return {
    sequenceNumber: row.sequenceNumber,
    exerciseTypeKey:
      row.exerciseTypeKey as TrainingStepResolved["exerciseTypeKey"],
    exerciseRulesetVersionKey: row.exerciseRulesetVersionKey,
    gameTypeKey: row.gameTypeKey,
    durationSeconds,
    configuration,
  };
}

export async function startTraining(
  playerId: string,
  routineTemplateName: string,
): Promise<ServiceResult<StartTrainingResult>> {
  const db = getDb();
  const resolved = await findRoutineTemplateSteps(db, routineTemplateName);
  if (!resolved) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown routineTemplateName" },
    };
  }

  const activeStatusId = await findGameStatusId(db, "ACTIVE");
  if (!activeStatusId) {
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      details: { reason: "reference data missing" },
    };
  }

  const steps = resolved.steps.map(resolveStep);
  const activityId = generateId();
  await insertTrainingActivity({
    activityId,
    playerId,
    activeStatusId,
    configurationId: generateId(),
    configuration: { routineName: routineTemplateName, steps },
  });

  return {
    ok: true,
    data: { activityId, routineName: routineTemplateName, steps },
  };
}
