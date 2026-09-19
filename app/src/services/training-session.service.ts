import { generateId } from "@lib/id";
import { getDb, withTransaction } from "@db/client";
import {
  findActiveSessionForExerciseType,
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
  abandonActiveTrainingActivities,
  findActivityConfiguration,
  findActivityStatus,
  findRoutineTemplateSteps,
  insertTrainingActivity,
  updateActivityStatusRecord,
} from "@repositories/training-session.repository";
import type { RoutineStepTemplateRow } from "@repositories/interfaces";
import { isActiveSessionConflict } from "./session.service";
import { getExerciseRulesetValidator } from "./exercise-rulesets/registry";
import { getRulesetValidator } from "./rulesets/registry";
import type {
  ServiceResult,
  StartTrainingResult,
  StartTrainingStepResult,
  TrainingStepResolved,
} from "./types";

const FINISHING_GAME_TYPE_KEY = "TUOD";
const FINISHING_RULESET_VERSION_KEY = "TUOD_V1";

/**
 * The exercise type whose steps run a game engine. Such a step pins a game
 * ruleset version on its session and has no exercise ruleset at all, so it is
 * the one step kind `stepConfigurationIssues` has no validator to apply.
 */
const GAME_EXERCISE_TYPE_KEY = "GAME";

/**
 * The capture/input mode pair a routine's GAME step validates and injects
 * under. Phase 1 always runs a GAME step under ANALYTICS/VISUAL_BOARD — the
 * only pair the routine player screen drives; Phase 2 will vary it with the
 * step's own capture setting.
 */
const ROUTINE_CAPTURE_MODE_KEY = "ANALYTICS";
const ROUTINE_INPUT_MODE_KEY = "VISUAL_BOARD";

function durationSecondsFor(
  durationTypeKey: string,
  durationValue: number,
): number {
  return durationTypeKey === "MINUTES" ? durationValue * 60 : durationValue;
}

/**
 * The template's `default_configuration` under the step's own overrides — what
 * the step's exercise ruleset validates, before any derived field is added to
 * it.
 */
function mergedConfiguration(
  row: RoutineStepTemplateRow,
): Record<string, unknown> {
  return {
    ...(row.defaultConfiguration as Record<string, unknown> | null),
    ...(row.stepConfiguration as Record<string, unknown> | null),
  };
}

/**
 * TUOD reads its timed length from `duration_type`/`duration_value`; a
 * routine step's own minutes win over the template default (D321 §3.5).
 */
function injectGameStepDuration(
  row: RoutineStepTemplateRow,
  configuration: Record<string, unknown>,
): void {
  if (row.gameTypeKey !== FINISHING_GAME_TYPE_KEY) return;
  if (row.durationTypeKey !== "MINUTES") return;
  configuration.duration_type = "MINUTES";
  configuration.duration_value = row.durationValue;
}

/**
 * The step's configuration issues, or undefined when it validates. A GAME
 * step validates against the finishing ruleset (`TUOD_V1`) under the routine
 * capture pair (issue #392); Phase 2 generalises the pinned key to the
 * step's own game type.
 *
 * A non-game step that resolves no validator is itself an issue. That is the
 * assertion migration `0035` deliberately left out of the schema: a template
 * whose `exercise_ruleset_version_id` was never backfilled fails here, loudly,
 * instead of reaching the snapshot with an unvalidatable configuration.
 */
function stepConfigurationIssues(
  row: RoutineStepTemplateRow,
  configuration: Record<string, unknown>,
): unknown[] | undefined {
  if (row.exerciseTypeKey === GAME_EXERCISE_TYPE_KEY) {
    const validator = getRulesetValidator(FINISHING_RULESET_VERSION_KEY);
    if (!validator) {
      return [`no ruleset validator for ${FINISHING_RULESET_VERSION_KEY}`];
    }
    const result = validator.validateConfig({
      config: configuration,
      captureModeKey: ROUTINE_CAPTURE_MODE_KEY,
      inputModeKey: ROUTINE_INPUT_MODE_KEY,
    });
    return result.valid ? undefined : (result.issues as unknown[]);
  }

  const validator = row.exerciseRulesetVersionKey
    ? getExerciseRulesetValidator(row.exerciseRulesetVersionKey)
    : undefined;
  if (!validator) {
    return [
      `no exercise ruleset validator for ${row.exerciseRulesetVersionKey ?? "an unpinned ruleset version"}`,
    ];
  }

  const result = validator.validateConfig({ config: configuration });
  return result.ok ? undefined : result.issues;
}

function resolveStep(
  row: RoutineStepTemplateRow,
  configuration: Record<string, unknown>,
): TrainingStepResolved {
  const durationSeconds = durationSecondsFor(
    row.durationTypeKey,
    row.durationValue,
  );
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
  routineTemplateId: string,
): Promise<ServiceResult<StartTrainingResult>> {
  const db = getDb();
  const resolved = await findRoutineTemplateSteps(
    db,
    routineTemplateId,
    playerId,
  );
  if (!resolved) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown routineTemplateId" },
    };
  }

  const activeStatusId = await findGameStatusId(db, "ACTIVE");
  const abandonedStatusId = await findGameStatusId(db, "ABANDONED");
  if (!activeStatusId || !abandonedStatusId) {
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      details: { reason: "reference data missing" },
    };
  }

  const steps: TrainingStepResolved[] = [];
  const invalid: { sequenceNumber: number; issues: unknown[] }[] = [];
  for (const row of resolved.steps) {
    const configuration = mergedConfiguration(row);
    injectGameStepDuration(row, configuration);
    const issues = stepConfigurationIssues(row, configuration);
    if (issues) invalid.push({ sequenceNumber: row.sequenceNumber, issues });
    steps.push(resolveStep(row, configuration));
  }
  if (invalid.length > 0) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "invalid step configuration", steps: invalid },
    };
  }

  const activityId = generateId();
  await withTransaction(async (tx) => {
    await abandonActiveTrainingActivities(tx, { playerId, abandonedStatusId });
    await insertTrainingActivity(tx, {
      activityId,
      playerId,
      activeStatusId,
      configurationId: generateId(),
      configuration: {
        routineTemplateId: resolved.routineTemplateId,
        routineName: resolved.routineName,
        steps,
      },
    });
  });

  return {
    ok: true,
    data: {
      activityId,
      routineTemplateId: resolved.routineTemplateId,
      routineName: resolved.routineName,
      steps,
    },
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

async function resolveActiveExerciseConflict(
  db: Db,
  playerId: string,
  exerciseTypeId: string,
): Promise<ServiceResult<StartTrainingStepResult>> {
  const active = await findActiveSessionForExerciseType(
    db,
    playerId,
    exerciseTypeId,
  );
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

/**
 * The capture pair a dart-throwing exercise step records under. Switching and
 * Double Pattern capture every dart on the visual board, exactly as an
 * `ANALYTICS` + `VISUAL_BOARD` game does, and `exercise_sessions` stores the
 * pair as both-or-neither (`chk_exercise_sessions_capture_pair`, migration
 * `0029`). Warm-Up throws no recorded dart, so it keeps the NULL pair.
 */
const DART_EXERCISE_CAPTURE_MODE_KEY = "ANALYTICS";
const DART_EXERCISE_INPUT_MODE_KEY = "VISUAL_BOARD";

const DART_EXERCISE_TYPE_KEYS = new Set(["SWITCHING", "DOUBLE_PATTERN"]);

type NonGameReferences = {
  exerciseTypeId: string;
  exerciseRulesetVersionId?: string;
  captureModeId?: number;
  inputModeId?: number;
};

/**
 * Reference ids a non-game step's session row needs. Returns undefined when any
 * required id is missing: the capture pair is required exactly for the exercise
 * types that record darts (`chk_exercise_sessions_capture_pair`, migration
 * `0029`).
 */
async function resolveNonGameReferences(
  db: Db,
  step: TrainingStepResolved,
): Promise<NonGameReferences | undefined> {
  const exerciseTypeId = await findExerciseTypeId(db, step.exerciseTypeKey);
  if (!exerciseTypeId) return undefined;

  const exerciseRulesetVersionId = step.exerciseRulesetVersionKey
    ? await findExerciseRulesetVersionId(db, step.exerciseRulesetVersionKey)
    : undefined;
  if (!DART_EXERCISE_TYPE_KEYS.has(step.exerciseTypeKey)) {
    return { exerciseTypeId, exerciseRulesetVersionId };
  }

  const captureModeId = await findCaptureModeId(
    db,
    DART_EXERCISE_CAPTURE_MODE_KEY,
  );
  const inputModeId = await findInputModeId(db, DART_EXERCISE_INPUT_MODE_KEY);
  if (!captureModeId || !inputModeId) return undefined;
  return {
    exerciseTypeId,
    exerciseRulesetVersionId,
    captureModeId,
    inputModeId,
  };
}

async function startNonGameStep(
  ctx: StepStartContext,
): Promise<ServiceResult<StartTrainingStepResult>> {
  const { db, step } = ctx;
  const refs = await resolveNonGameReferences(db, step);
  if (!refs) {
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      details: { reason: "reference data missing" },
    };
  }
  try {
    await withTransaction((tx) =>
      insertExerciseSessionRecord(tx, {
        activityId: ctx.activityId,
        sessionId: ctx.sessionId,
        configurationId: generateId(),
        participants: ctx.participants,
        playerId: ctx.playerId,
        activeStatusId: ctx.activeStatusId,
        captureModeId: refs.captureModeId,
        inputModeId: refs.inputModeId,
        exerciseTypeId: refs.exerciseTypeId,
        exerciseRulesetVersionId: refs.exerciseRulesetVersionId,
        routineStepSequenceNumber: ctx.sequenceNumber,
        configuration: step.configuration,
      }),
    );
  } catch (error) {
    if (!isActiveSessionConflict(error)) throw error;
    return resolveActiveExerciseConflict(db, ctx.playerId, refs.exerciseTypeId);
  }

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
  const snapshot = await findActivityConfiguration(db, activityId, playerId);
  if (!snapshot) {
    return {
      ok: false,
      code: "SESSION_OWNERSHIP_MISMATCH",
      details: { activityId },
    };
  }

  const step = (snapshot.steps as TrainingStepResolved[] | undefined)?.find(
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

  return step.exerciseTypeKey === GAME_EXERCISE_TYPE_KEY
    ? startGameStep(ctx)
    : startNonGameStep(ctx);
}

/**
 * Terminal transition for a training activity. The UPDATE itself carries the
 * "still ACTIVE" predicate, so a completed routine can never be re-transitioned
 * and lose its original `completed_at` (root `CLAUDE.md` § Hard Invariants).
 */
async function transitionTrainingActivity(
  playerId: string,
  activityId: string,
  statusKey: "COMPLETED" | "ABANDONED",
): Promise<ServiceResult<{ activityId: string; completedAt: string }>> {
  const db = getDb();
  const statusId = await findGameStatusId(db, statusKey);
  const activeStatusId = await findGameStatusId(db, "ACTIVE");
  if (!statusId || !activeStatusId) {
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
    expectedStatusId: activeStatusId,
  });
  if (updated) return { ok: true, data: updated };

  const current = await findActivityStatus(db, activityId, playerId);
  if (!current) {
    return { ok: false, code: "NOT_FOUND", details: { activityId } };
  }
  return {
    ok: false,
    code: "SESSION_ALREADY_COMPLETED",
    details: { activityId },
  };
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
