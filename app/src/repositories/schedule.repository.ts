import { and, asc, eq } from "drizzle-orm";
import { getDb, withTransaction } from "@db/client";
import {
  trainingScheduleDays,
  trainingSchedules,
  vTrainingScheduleDays,
  vTrainingSchedules,
} from "@db/schema";
import type { TrainingScheduleDayRow, TrainingScheduleRow } from "./interfaces";
import { viewRows } from "./view-rows";

type Db = ReturnType<typeof getDb>;

type Tx = Parameters<typeof withTransaction>[0] extends (tx: infer T) => unknown
  ? T
  : never;

/**
 * The caller's own schedules, optionally narrowed to one, in name order with
 * `schedule_id` breaking a tie — without an explicit order the list is free
 * to reshuffle between reads, and an activate rewrites `updated_at` on every
 * row the player owns.
 */
export async function findScheduleRows(
  db: Db,
  playerId: string,
  scheduleId?: string,
): Promise<TrainingScheduleRow[]> {
  const scope = eq(vTrainingSchedules.playerId, playerId);
  const rows = await db
    .select({
      scheduleId: vTrainingSchedules.scheduleId,
      playerId: vTrainingSchedules.playerId,
      name: vTrainingSchedules.name,
      isActive: vTrainingSchedules.isActive,
      updatedAt: vTrainingSchedules.updatedAt,
      dayCount: vTrainingSchedules.dayCount,
    })
    .from(vTrainingSchedules)
    .where(
      scheduleId
        ? and(eq(vTrainingSchedules.scheduleId, scheduleId), scope)
        : scope,
    )
    .orderBy(asc(vTrainingSchedules.name), asc(vTrainingSchedules.scheduleId));
  return viewRows<TrainingScheduleRow>(rows);
}

/** The caller's own schedule days, optionally narrowed to one schedule, weekday order. */
export async function findScheduleDayRows(
  db: Db,
  playerId: string,
  scheduleId?: string,
): Promise<TrainingScheduleDayRow[]> {
  const scope = eq(vTrainingScheduleDays.playerId, playerId);
  const rows = await db
    .select({
      scheduleId: vTrainingScheduleDays.scheduleId,
      playerId: vTrainingScheduleDays.playerId,
      scheduleName: vTrainingScheduleDays.scheduleName,
      isActive: vTrainingScheduleDays.isActive,
      dayOfWeek: vTrainingScheduleDays.dayOfWeek,
      routineTemplateId: vTrainingScheduleDays.routineTemplateId,
      routineName: vTrainingScheduleDays.routineName,
      routineMinutes: vTrainingScheduleDays.routineMinutes,
    })
    .from(vTrainingScheduleDays)
    .where(
      scheduleId
        ? and(eq(vTrainingScheduleDays.scheduleId, scheduleId), scope)
        : scope,
    )
    .orderBy(asc(vTrainingScheduleDays.dayOfWeek));
  return viewRows<TrainingScheduleDayRow>(rows);
}

/**
 * Schedule ids of the caller's own schedules that still assign this routine
 * to some weekday — the `scheduleIds` detail `deleteRoutine`'s RESTRICT
 * mapping reports (`routine.service.ts`).
 */
export async function findScheduleIdsUsingRoutine(
  db: Db,
  playerId: string,
  routineTemplateId: string,
): Promise<string[]> {
  const rows = viewRows<{ scheduleId: string }>(
    await db
      .select({ scheduleId: vTrainingScheduleDays.scheduleId })
      .from(vTrainingScheduleDays)
      .where(
        and(
          eq(vTrainingScheduleDays.routineTemplateId, routineTemplateId),
          eq(vTrainingScheduleDays.playerId, playerId),
        ),
      ),
  );
  return [...new Set(rows.map((row) => row.scheduleId))];
}

export async function insertScheduleRecord(
  tx: Tx,
  input: { scheduleId: string; playerId: string; name: string },
): Promise<void> {
  const now = new Date().toISOString();
  await tx.insert(trainingSchedules).values({
    id: input.scheduleId,
    playerId: input.playerId,
    name: input.name,
    isActive: false,
    createdAt: now,
    updatedAt: now,
  });
}

/** True when the caller's own schedule was updated. */
export async function updateScheduleRecord(
  tx: Tx,
  input: { scheduleId: string; playerId: string; name: string },
): Promise<boolean> {
  const rows = await tx
    .update(trainingSchedules)
    .set({ name: input.name, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(trainingSchedules.id, input.scheduleId),
        eq(trainingSchedules.playerId, input.playerId),
      ),
    )
    .returning({ id: trainingSchedules.id });
  return rows.length === 1;
}

/** Full replace: every existing day of the schedule is dropped, then the given set is inserted. */
export async function replaceScheduleDayRecords(
  tx: Tx,
  input: {
    scheduleId: string;
    days: { id: string; dayOfWeek: number; routineTemplateId: string }[];
  },
): Promise<void> {
  await tx
    .delete(trainingScheduleDays)
    .where(eq(trainingScheduleDays.trainingScheduleId, input.scheduleId));
  if (input.days.length === 0) return;
  const now = new Date().toISOString();
  await tx.insert(trainingScheduleDays).values(
    input.days.map((day) => ({
      id: day.id,
      trainingScheduleId: input.scheduleId,
      dayOfWeek: day.dayOfWeek,
      routineTemplateId: day.routineTemplateId,
      createdAt: now,
    })),
  );
}

/**
 * Clears every one of the caller's schedules before setting the target,
 * ordered so the partial unique index (`uq_training_schedules_player_active`)
 * never trips. False when the target is not the caller's own, and nothing is
 * written in that case.
 *
 * Ownership is read first, inside the same transaction, rather than inferred
 * from the second update's `RETURNING`: reading it afterwards still left the
 * clear committed, so activating an unknown or foreign id answered `404`
 * *and* silently deactivated whatever the player really had active. The read
 * is against the runtime table, not `v_training_schedules`, so it sees this
 * transaction's own writes.
 */
export async function setActiveSchedule(
  tx: Tx,
  input: { playerId: string; scheduleId: string },
): Promise<boolean> {
  const owned = await tx
    .select({ id: trainingSchedules.id })
    .from(trainingSchedules)
    .where(
      and(
        eq(trainingSchedules.id, input.scheduleId),
        eq(trainingSchedules.playerId, input.playerId),
      ),
    );
  if (owned.length !== 1) return false;
  await tx
    .update(trainingSchedules)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(eq(trainingSchedules.playerId, input.playerId));
  await tx
    .update(trainingSchedules)
    .set({ isActive: true, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(trainingSchedules.id, input.scheduleId),
        eq(trainingSchedules.playerId, input.playerId),
      ),
    );
  return true;
}

/** True when the caller's own schedule was deactivated. */
export async function clearActiveSchedule(
  db: Db,
  input: { playerId: string; scheduleId: string },
): Promise<boolean> {
  const rows = await db
    .update(trainingSchedules)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(trainingSchedules.id, input.scheduleId),
        eq(trainingSchedules.playerId, input.playerId),
      ),
    )
    .returning({ id: trainingSchedules.id });
  return rows.length === 1;
}

/** Days cascade (`fk_training_schedule_days_training_schedule`). True when a row was deleted. */
export async function deleteScheduleRecord(
  db: Db,
  scheduleId: string,
  playerId: string,
): Promise<boolean> {
  const rows = await db
    .delete(trainingSchedules)
    .where(
      and(
        eq(trainingSchedules.id, scheduleId),
        eq(trainingSchedules.playerId, playerId),
      ),
    )
    .returning({ id: trainingSchedules.id });
  return rows.length === 1;
}
