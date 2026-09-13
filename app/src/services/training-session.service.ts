import { generateId } from "@lib/id";
import { getDb, withTransaction } from "@db/client";
import {
  findActiveSessionForGameType,
  findCaptureModeId,
  findExerciseRulesetVersionId,
  findExerciseTypeId,
  findGameStatusId,
  findGameTypeAndRuleset,
  findInputModeId,
  findParticipantTypeId,
  findPlayerDisplayName,
  insertExerciseSessionRecord,
} from "@repositories/session.repository";
import {
  findActivityConfiguration,
  findRoutineTemplateSteps,
  insertTrainingActivity,
  updateActivityStatusRecord,
} from "@repositories/training-session.repository";
import type { RoutineStepTemplateRow } from "@repositories/interfaces";
import { isActiveSessionConflict } from "./session.service";
import type {
  ServiceResult,
  StartTrainingResult,
  StartTrainingStepResult,
  TrainingStepResolved,
} from "./types";

const FINISHING_GAME_TYPE_KEY = "TUOD";
const FINISHING_RULESET_VERSION_KEY = "TUOD_V1";

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

type Db = ReturnType<typeof getDb>;

type StepStartContext = {
  db: Db;
  playerId: string;
  activityId: string;
  sequenceNumber: number;
  step: TrainingStepResolved;
  activeStatusId: number;
  sessionId: string;
  participantId: string;
  displayName: string;
  participants: {
    id: string;
    participantTypeId: number;
    playerId: string;
    displayName: string;
  }[];
};

async function startGameStep(
  ctx: StepStartContext,
): Promise<ServiceResult<StartTrainingStepResult>> {
  const { db, playerId, activityId, sequenceNumber, step } = ctx;
  const exerciseTypeId = await findExerciseTypeId(db, "GAME");
  const gameLookup = await findGameTypeAndRuleset(
    db,
    FINISHING_GAME_TYPE_KEY,
    FINISHING_RULESET_VERSION_KEY,
  );
  const captureModeId = await findCaptureModeId(db, "ANALYTICS");
  const inputModeId = await findInputModeId(db, "VISUAL_BOARD");
  if (!exerciseTypeId || !gameLookup || !captureModeId || !inputModeId) {
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      details: { reason: "reference data missing" },
    };
  }
  try {
    await withTransaction((tx) =>
      insertExerciseSessionRecord(tx, {
        activityId,
        sessionId: ctx.sessionId,
        configurationId: generateId(),
        participants: ctx.participants,
        playerId,
        gameTypeId: gameLookup.gameTypeId,
        rulesetVersionId: gameLookup.rulesetVersionId,
        captureModeId,
        inputModeId,
        activeStatusId: ctx.activeStatusId,
        exerciseTypeId,
        routineStepSequenceNumber: sequenceNumber,
        configuration: step.configuration,
      }),
    );
  } catch (error) {
    if (!isActiveSessionConflict(error)) throw error;
    return resolveActiveSessionConflict(db, playerId, gameLookup.gameTypeId);
  }
  return {
    ok: true,
    data: {
      sessionId: ctx.sessionId,
      exerciseTypeKey: "GAME",
      configuration: step.configuration,
      participant: { ref: ctx.participantId, displayName: ctx.displayName },
      gameTypeKey: FINISHING_GAME_TYPE_KEY,
      rulesetVersionKey: FINISHING_RULESET_VERSION_KEY,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    },
  };
}

async function resolveActiveSessionConflict(
  db: Db,
  playerId: string,
  gameTypeId: string,
): Promise<ServiceResult<StartTrainingStepResult>> {
  const active = await findActiveSessionForGameType(db, playerId, gameTypeId);
  return active
    ? {
        ok: false,
        code: "SESSION_ALREADY_ACTIVE",
        details: { sessionId: active.sessionId, startedAt: active.startedAt },
      }
    : {
        ok: false,
        code: "INTERNAL_ERROR",
        details: { reason: "conflict with no active row" },
      };
}

async function startNonGameStep(
  ctx: StepStartContext,
): Promise<ServiceResult<StartTrainingStepResult>> {
  const { db, step } = ctx;
  const exerciseTypeId = await findExerciseTypeId(db, step.exerciseTypeKey);
  const exerciseRulesetVersionId = step.exerciseRulesetVersionKey
    ? await findExerciseRulesetVersionId(db, step.exerciseRulesetVersionKey)
    : undefined;
  if (!exerciseTypeId) {
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      details: { reason: "reference data missing" },
    };
  }
  await withTransaction((tx) =>
    insertExerciseSessionRecord(tx, {
      activityId: ctx.activityId,
      sessionId: ctx.sessionId,
      configurationId: generateId(),
      participants: ctx.participants,
      playerId: ctx.playerId,
      activeStatusId: ctx.activeStatusId,
      exerciseTypeId,
      exerciseRulesetVersionId,
      routineStepSequenceNumber: ctx.sequenceNumber,
      configuration: step.configuration,
    }),
  );

  return {
    ok: true,
    data: {
      sessionId: ctx.sessionId,
      exerciseTypeKey: step.exerciseTypeKey,
      configuration: step.configuration,
      participant: { ref: ctx.participantId, displayName: ctx.displayName },
    },
  };
}

export async function startTrainingStep(
  playerId: string,
  activityId: string,
  sequenceNumber: number,
): Promise<ServiceResult<StartTrainingStepResult>> {
  const db = getDb();
  const snapshot = await findActivityConfiguration(db, activityId);
  const step = (snapshot?.steps as TrainingStepResolved[] | undefined)?.find(
    (candidate) => candidate.sequenceNumber === sequenceNumber,
  );
  if (!step) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown sequenceNumber" },
    };
  }

  const activeStatusId = await findGameStatusId(db, "ACTIVE");
  const playerParticipantTypeId = await findParticipantTypeId(db, "PLAYER");
  const displayName = await findPlayerDisplayName(db, playerId);
  if (!activeStatusId || !playerParticipantTypeId || !displayName) {
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      details: { reason: "reference data missing" },
    };
  }

  const participantId = generateId();
  const ctx: StepStartContext = {
    db,
    playerId,
    activityId,
    sequenceNumber,
    step,
    activeStatusId,
    sessionId: generateId(),
    participantId,
    displayName,
    participants: [
      {
        id: participantId,
        participantTypeId: playerParticipantTypeId,
        playerId,
        displayName,
      },
    ],
  };

  return step.exerciseTypeKey === "GAME"
    ? startGameStep(ctx)
    : startNonGameStep(ctx);
}

async function transitionTrainingActivity(
  playerId: string,
  activityId: string,
  statusKey: "COMPLETED" | "ABANDONED",
): Promise<ServiceResult<{ activityId: string; completedAt: string }>> {
  const db = getDb();
  const statusId = await findGameStatusId(db, statusKey);
  if (!statusId) {
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      details: { reason: "reference data missing" },
    };
  }
  const updated = await updateActivityStatusRecord(db, {
    activityId,
    playerId,
    statusId,
  });
  if (!updated) {
    return { ok: false, code: "NOT_FOUND", details: { activityId } };
  }
  return { ok: true, data: updated };
}

export async function completeTraining(
  playerId: string,
  activityId: string,
): Promise<ServiceResult<{ activityId: string; completedAt: string }>> {
  return transitionTrainingActivity(playerId, activityId, "COMPLETED");
}

export async function abandonTraining(
  playerId: string,
  activityId: string,
): Promise<ServiceResult<{ activityId: string; completedAt: string }>> {
  return transitionTrainingActivity(playerId, activityId, "ABANDONED");
}
