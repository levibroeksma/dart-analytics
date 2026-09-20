import { generateId } from "@lib/id";
import { getDb, withTransaction } from "@db/client";
import {
  clearActiveSchedule,
  deleteScheduleRecord,
  findScheduleDayRows,
  findScheduleRows,
  insertScheduleRecord,
  replaceScheduleDayRecords,
  setActiveSchedule,
  updateScheduleRecord,
} from "@repositories/schedule.repository";
import { getRoutine } from "@services/routine.service";
import type {
  Schedule,
  ScheduleSummary,
  ScheduleWriteInput,
  ServiceResult,
} from "./types";

function notFound(scheduleId: string): ServiceResult<never> {
  return { ok: false, code: "NOT_FOUND", details: { scheduleId } };
}

/** Reads a schedule back through both views; `null` when it does not exist for this player. */
async function buildSchedule(
  playerId: string,
  scheduleId: string,
): Promise<Schedule | null> {
  const [scheduleRow] = await findScheduleRows(getDb(), playerId, scheduleId);
  if (!scheduleRow) return null;
  const dayRows = await findScheduleDayRows(getDb(), playerId, scheduleId);
  return {
    scheduleId: scheduleRow.scheduleId,
    name: scheduleRow.name,
    isActive: scheduleRow.isActive,
    days: dayRows
      .map((row) => ({
        dayOfWeek: row.dayOfWeek,
        routineId: row.routineTemplateId,
        routineName: row.routineName,
        routineMinutes: row.routineMinutes,
      }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
  };
}

export async function listSchedules(
  playerId: string,
): Promise<ServiceResult<{ items: ScheduleSummary[]; nextCursor: null }>> {
  const rows = await findScheduleRows(getDb(), playerId);
  return {
    ok: true,
    data: {
      items: rows.map((row) => ({
        scheduleId: row.scheduleId,
        name: row.name,
        isActive: row.isActive,
        dayCount: row.dayCount,
      })),
      nextCursor: null,
    },
  };
}

export async function getSchedule(
  playerId: string,
  scheduleId: string,
): Promise<ServiceResult<Schedule>> {
  const schedule = await buildSchedule(playerId, scheduleId);
  return schedule ? { ok: true, data: schedule } : notFound(scheduleId);
}

export async function getActiveSchedule(
  playerId: string,
): Promise<ServiceResult<Schedule | null>> {
  const rows = await findScheduleRows(getDb(), playerId);
  const active = rows.find((row) => row.isActive);
  if (!active) return { ok: true, data: null };
  return getSchedule(playerId, active.scheduleId);
}

/**
 * Domain checks the request schema cannot make: every `routineTemplateId` is
 * system or caller-owned (via `getRoutine`), and no weekday repeats — the
 * unique index only enforces the second within one schedule already saved.
 */
async function validateDays(
  playerId: string,
  days: ScheduleWriteInput["days"],
): Promise<ServiceResult<never> | undefined> {
  const seen = new Set<number>();
  for (const day of days) {
    if (seen.has(day.dayOfWeek)) {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        details: { reason: "duplicate dayOfWeek", dayOfWeek: day.dayOfWeek },
      };
    }
    seen.add(day.dayOfWeek);
  }
  for (const day of days) {
    const routine = await getRoutine(playerId, day.routineTemplateId);
    if (!routine.ok) {
      return {
        ok: false,
        code: "VALIDATION_FAILED",
        details: {
          reason: "unknown routineTemplateId",
          dayOfWeek: day.dayOfWeek,
        },
      };
    }
  }
  return undefined;
}

function normalise(input: ScheduleWriteInput): ScheduleWriteInput {
  return { ...input, name: input.name.trim() };
}

export async function createSchedule(
  playerId: string,
  rawInput: ScheduleWriteInput,
): Promise<ServiceResult<Schedule>> {
  const input = normalise(rawInput);
  const issue = await validateDays(playerId, input.days);
  if (issue) return issue;

  const scheduleId = generateId();
  await withTransaction(async (tx) => {
    await insertScheduleRecord(tx, { scheduleId, playerId, name: input.name });
    await replaceScheduleDayRecords(tx, {
      scheduleId,
      days: input.days.map((day) => ({
        id: generateId(),
        dayOfWeek: day.dayOfWeek,
        routineTemplateId: day.routineTemplateId,
      })),
    });
  });
  return getSchedule(playerId, scheduleId);
}

export async function replaceSchedule(
  playerId: string,
  scheduleId: string,
  rawInput: ScheduleWriteInput,
): Promise<ServiceResult<Schedule>> {
  const input = normalise(rawInput);
  const [existing] = await findScheduleRows(getDb(), playerId, scheduleId);
  if (!existing) return notFound(scheduleId);
  const issue = await validateDays(playerId, input.days);
  if (issue) return issue;

  await withTransaction(async (tx) => {
    await updateScheduleRecord(tx, { scheduleId, playerId, name: input.name });
    await replaceScheduleDayRecords(tx, {
      scheduleId,
      days: input.days.map((day) => ({
        id: generateId(),
        dayOfWeek: day.dayOfWeek,
        routineTemplateId: day.routineTemplateId,
      })),
    });
  });
  return getSchedule(playerId, scheduleId);
}

export async function activateSchedule(
  playerId: string,
  scheduleId: string,
): Promise<ServiceResult<Schedule>> {
  const activated = await withTransaction((tx) =>
    setActiveSchedule(tx, { playerId, scheduleId }),
  );
  if (!activated) return notFound(scheduleId);
  return getSchedule(playerId, scheduleId);
}

export async function deactivateSchedule(
  playerId: string,
  scheduleId: string,
): Promise<ServiceResult<Schedule>> {
  const cleared = await clearActiveSchedule(getDb(), { playerId, scheduleId });
  if (!cleared) return notFound(scheduleId);
  return getSchedule(playerId, scheduleId);
}

export async function deleteSchedule(
  playerId: string,
  scheduleId: string,
): Promise<ServiceResult<null>> {
  const deleted = await deleteScheduleRecord(getDb(), scheduleId, playerId);
  return deleted ? { ok: true, data: null } : notFound(scheduleId);
}
