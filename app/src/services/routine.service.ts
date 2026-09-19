import { generateId } from "@lib/id";
import { getDb, withTransaction } from "@db/client";
import { tuodDurationBounds } from "@lib/game/tuod-duration";
import {
  MIN_USER_ROUTINE_MINUTES,
  validateRoutineDuration,
} from "@modules/training/routines/routine-duration.module";
import {
  deleteRoutineStepRecords,
  deleteRoutineTemplateRecord,
  findDurationTypeId,
  findExerciseTemplateCatalog,
  findRoutineExecutionRows,
  insertRoutineStepRecords,
  insertRoutineTemplateRecord,
  updateRoutineTemplateRecord,
} from "@repositories/routine.repository";
import type {
  ExerciseTemplateCatalogRow,
  RoutineExecutionRow,
} from "@repositories/interfaces";
import type {
  ExerciseTemplateCatalogEntry,
  RoutineExecution,
  RoutineSummary,
  RoutineWriteInput,
  ServiceResult,
} from "./types";

const USER_STEP_DURATION_TYPE_KEY = "MINUTES";
const DURATION_BOUND_TRIGGER = "trg_routine_templates_duration_bounds";
const MAX_CAUSE_DEPTH = 8;

const SYSTEM_READ_ONLY: ServiceResult<never> = {
  ok: false,
  code: "VALIDATION_FAILED",
  details: { reason: "system routine is read-only" },
};

function notFound(routineId: string): ServiceResult<never> {
  return { ok: false, code: "NOT_FOUND", details: { routineId } };
}

/** Step rows of every routine in one view read, grouped in view order. */
function groupRoutineRows(rows: RoutineExecutionRow[]): RoutineExecution[] {
  const byId = new Map<string, RoutineExecution>();
  for (const row of rows) {
    const routine = byId.get(row.routineId) ?? {
      routineId: row.routineId,
      routineName: row.routineName,
      description: row.routineDescription,
      isSystemTemplate: row.isSystemTemplate,
      steps: [],
    };
    routine.steps.push({
      sequenceNumber: row.sequenceNumber,
      exerciseTemplateId: row.exerciseTemplateId,
      exerciseName: row.exerciseName,
      exerciseDescription: row.exerciseDescription,
      exerciseTypeKey: row.exerciseTypeKey,
      gameTypeKey: row.gameTypeKey,
      durationValue: row.durationValue,
      durationTypeKey: row.durationTypeKey,
    });
    byId.set(row.routineId, routine);
  }
  return [...byId.values()];
}

/** `totalMinutes` is derived per read, never stored (01-Routines.md §6). */
function summarise(routine: RoutineExecution): RoutineSummary {
  return {
    routineId: routine.routineId,
    routineName: routine.routineName,
    description: routine.description,
    isSystemTemplate: routine.isSystemTemplate,
    stepCount: routine.steps.length,
    totalMinutes: routine.steps.reduce(
      (total, step) =>
        step.durationTypeKey === USER_STEP_DURATION_TYPE_KEY
          ? total + step.durationValue
          : total,
      0,
    ),
  };
}

export async function listRoutines(
  playerId: string,
): Promise<ServiceResult<{ items: RoutineSummary[]; nextCursor: null }>> {
  const rows = await findRoutineExecutionRows(getDb(), playerId);
  return {
    ok: true,
    data: { items: groupRoutineRows(rows).map(summarise), nextCursor: null },
  };
}

export async function getRoutine(
  playerId: string,
  routineId: string,
): Promise<ServiceResult<RoutineExecution>> {
  const rows = await findRoutineExecutionRows(getDb(), playerId, routineId);
  const [routine] = groupRoutineRows(rows);
  return routine ? { ok: true, data: routine } : notFound(routineId);
}

function offerable(
  rows: ExerciseTemplateCatalogRow[],
): ExerciseTemplateCatalogRow[] {
  return rows.filter((row) => row.hasDefaultConfiguration);
}

export async function listExerciseTemplates(): Promise<
  ServiceResult<ExerciseTemplateCatalogEntry[]>
> {
  const rows = await findExerciseTemplateCatalog(getDb());
  return {
    ok: true,
    data: offerable(rows).map(
      ({ hasDefaultConfiguration: _flag, ...entry }) => entry,
    ),
  };
}

/**
 * Domain checks the request schema cannot make: catalog membership, the
 * game step's timed bound, and the routine's total (the `0038` trigger is
 * the guarantee behind this pre-check).
 */
function writeIssues(
  input: RoutineWriteInput,
  catalog: ExerciseTemplateCatalogRow[],
): ServiceResult<never> | undefined {
  const byId = new Map(
    offerable(catalog).map((row) => [row.exerciseTemplateId, row]),
  );
  const gameBounds = tuodDurationBounds("MINUTES");
  for (const [index, step] of input.steps.entries()) {
    const template = byId.get(step.exerciseTemplateId);
    if (!template) {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        details: { reason: "unknown exerciseTemplateId", step: index + 1 },
      };
    }
    if (
      template.exerciseTypeKey === "GAME" &&
      (step.durationValue < gameBounds.min ||
        step.durationValue > gameBounds.max)
    ) {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        details: {
          reason: "game step minutes out of bounds",
          step: index + 1,
          min: gameBounds.min,
          max: gameBounds.max,
        },
      };
    }
  }
  const duration = validateRoutineDuration(
    input.steps.map((step, index) => ({
      sequenceNumber: index + 1,
      durationTypeKey: step.durationTypeKey,
      durationValue: step.durationValue,
    })),
    { minMinutes: MIN_USER_ROUTINE_MINUTES },
  );
  if (!duration.ok) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "routine duration invalid", issues: duration.issues },
    };
  }
  return undefined;
}

/** The `0038` deferred trigger surfaces at commit, after every pre-check. */
function isRoutineDurationViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current; depth++) {
    const e = current as {
      code?: string;
      constraint?: string;
      message?: string;
      cause?: unknown;
    };
    if (
      e.code === "23514" &&
      (e.constraint === DURATION_BOUND_TRIGGER ||
        (e.message?.includes(DURATION_BOUND_TRIGGER) ?? false))
    ) {
      return true;
    }
    if (e.cause === current) return false;
    current = e.cause;
  }
  return false;
}

type Tx = Parameters<Parameters<typeof withTransaction>[0]>[0];

async function writeSteps(
  tx: Tx,
  routineId: string,
  durationTypeId: number,
  input: RoutineWriteInput,
): Promise<void> {
  await insertRoutineStepRecords(tx, {
    routineId,
    durationTypeId,
    steps: input.steps.map((step) => ({
      id: generateId(),
      exerciseTemplateId: step.exerciseTemplateId,
      durationValue: step.durationValue,
    })),
  });
}

function normalise(input: RoutineWriteInput): RoutineWriteInput {
  return {
    ...input,
    name: input.name.trim(),
    description: input.description?.trim() || null,
  };
}

export async function createRoutine(
  playerId: string,
  rawInput: RoutineWriteInput,
): Promise<ServiceResult<RoutineExecution>> {
  const input = normalise(rawInput);
  const db = getDb();
  const issue = writeIssues(input, await findExerciseTemplateCatalog(db));
  if (issue) return issue;
  const durationTypeId = await findDurationTypeId(
    db,
    USER_STEP_DURATION_TYPE_KEY,
  );
  if (!durationTypeId) {
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      details: { reason: "reference data missing" },
    };
  }

  const routineId = generateId();
  try {
    await withTransaction(async (tx) => {
      await insertRoutineTemplateRecord(tx, {
        routineId,
        playerId,
        name: input.name,
        description: input.description,
      });
      await writeSteps(tx, routineId, durationTypeId, input);
    });
  } catch (error) {
    if (!isRoutineDurationViolation(error)) throw error;
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "routine duration out of bounds" },
    };
  }
  return getRoutine(playerId, routineId);
}

async function ownWritable(
  playerId: string,
  routineId: string,
): Promise<ServiceResult<never> | undefined> {
  const existing = await getRoutine(playerId, routineId);
  if (!existing.ok) return existing;
  if (existing.data.isSystemTemplate) return SYSTEM_READ_ONLY;
  return undefined;
}

export async function replaceRoutine(
  playerId: string,
  routineId: string,
  rawInput: RoutineWriteInput,
): Promise<ServiceResult<RoutineExecution>> {
  const input = normalise(rawInput);
  const blocked = await ownWritable(playerId, routineId);
  if (blocked) return blocked;
  const db = getDb();
  const issue = writeIssues(input, await findExerciseTemplateCatalog(db));
  if (issue) return issue;
  const durationTypeId = await findDurationTypeId(
    db,
    USER_STEP_DURATION_TYPE_KEY,
  );
  if (!durationTypeId) {
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      details: { reason: "reference data missing" },
    };
  }

  try {
    const updated = await withTransaction(async (tx) => {
      const ok = await updateRoutineTemplateRecord(tx, {
        routineId,
        playerId,
        name: input.name,
        description: input.description,
      });
      if (!ok) return false;
      await deleteRoutineStepRecords(tx, routineId);
      await writeSteps(tx, routineId, durationTypeId, input);
      return true;
    });
    if (!updated) return notFound(routineId);
  } catch (error) {
    if (!isRoutineDurationViolation(error)) throw error;
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "routine duration out of bounds" },
    };
  }
  return getRoutine(playerId, routineId);
}

/**
 * Completed trainings keep their snapshot in `activity_configurations` and
 * never reference the template (Pattern 4), so a delete touches no history.
 */
export async function deleteRoutine(
  playerId: string,
  routineId: string,
): Promise<ServiceResult<null>> {
  const blocked = await ownWritable(playerId, routineId);
  if (blocked) return blocked;
  const deleted = await deleteRoutineTemplateRecord(
    getDb(),
    routineId,
    playerId,
  );
  return deleted ? { ok: true, data: null } : notFound(routineId);
}
