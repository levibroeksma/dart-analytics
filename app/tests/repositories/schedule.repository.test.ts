import { describe, it, expect, vi } from "vitest";
import { renderingDb, onlyStatement } from "./render-sql";
import {
  findScheduleRows,
  findScheduleDayRows,
  findScheduleIdsUsingRoutine,
  insertScheduleRecord,
  updateScheduleRecord,
  replaceScheduleDayRecords,
  setActiveSchedule,
  clearActiveSchedule,
  deleteScheduleRecord,
} from "@repositories/schedule.repository";

function fakeSelect(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
}

describe("findScheduleRows", () => {
  it("reads v_training_schedules scoped to the caller", async () => {
    const { db, statements } = renderingDb([]);
    await findScheduleRows(db, "p1");
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_training_schedules"');
    expect(sql).toContain('"player_id" = $1');
    expect(statements[0].params).toEqual(["p1"]);
  });

  it("orders by name, then schedule id, so list order never reshuffles", async () => {
    const { db, statements } = renderingDb([]);
    await findScheduleRows(db, "p1");
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/order by .*"name".*,.*"schedule_id"/);
  });

  it("adds the schedule id predicate when one is given", async () => {
    const { db, statements } = renderingDb([]);
    await findScheduleRows(db, "p1", "sch-1");
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/"schedule_id" = \$1 and .*"player_id" = \$2/);
    expect(statements[0].params).toEqual(["sch-1", "p1"]);
  });
});

describe("findScheduleDayRows", () => {
  it("reads v_training_schedule_days filtered by player_id, ordered by day_of_week", async () => {
    const { db, statements } = renderingDb([]);
    await findScheduleDayRows(db, "p1");
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_training_schedule_days"');
    expect(sql).toContain('"player_id" = $1');
    expect(sql).toMatch(/order by .*"day_of_week"/);
    expect(statements[0].params).toEqual(["p1"]);
  });

  it("adds the schedule id predicate when one is given", async () => {
    const { db, statements } = renderingDb([]);
    await findScheduleDayRows(db, "p1", "sch-1");
    const sql = onlyStatement(statements);
    expect(sql).toMatch(/"schedule_id" = \$1 and .*"player_id" = \$2/);
    expect(statements[0].params).toEqual(["sch-1", "p1"]);
  });
});

describe("findScheduleIdsUsingRoutine", () => {
  it("reads v_training_schedule_days by routine_template_id and player_id", async () => {
    const { db, statements } = renderingDb([]);
    await findScheduleIdsUsingRoutine(db, "p1", "rt-1");
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_training_schedule_days"');
    expect(sql).toMatch(/"routine_template_id" = \$1 and .*"player_id" = \$2/);
    expect(statements[0].params).toEqual(["rt-1", "p1"]);
  });

  it("returns distinct schedule ids", async () => {
    const db = {
      select: vi.fn(() =>
        fakeSelect([
          { scheduleId: "sch-1" },
          { scheduleId: "sch-1" },
          { scheduleId: "sch-2" },
        ]),
      ),
    } as any;
    const ids = await findScheduleIdsUsingRoutine(db, "p1", "rt-1");
    expect(ids).toEqual(["sch-1", "sch-2"]);
  });
});

describe("writes", () => {
  it("insertScheduleRecord inserts an inactive schedule owned by the caller", async () => {
    const { db, statements } = renderingDb([]);
    await insertScheduleRecord(db, {
      scheduleId: "sch-1",
      playerId: "p1",
      name: "Mine",
    });
    const sql = onlyStatement(statements);
    expect(sql).toContain('insert into "training_schedules"');
    expect(statements[0].params).toEqual(
      expect.arrayContaining(["sch-1", "p1", "Mine", false]),
    );
  });

  it("updateScheduleRecord targets the caller's own schedule only", async () => {
    const { db, statements } = renderingDb([{ id: "sch-1" }]);
    const updated = await updateScheduleRecord(db, {
      scheduleId: "sch-1",
      playerId: "p1",
      name: "New",
    });
    const sql = onlyStatement(statements);
    expect(updated).toBe(true);
    expect(sql).toContain('update "training_schedules"');
    expect(sql).toMatch(/"id" = \$\d+ and .*"player_id" = \$\d+/);
  });

  it("replaceScheduleDayRecords renders delete then insert", async () => {
    const { db, statements } = renderingDb([]);
    await replaceScheduleDayRecords(db, {
      scheduleId: "sch-1",
      days: [
        { id: "d1", dayOfWeek: 1, routineTemplateId: "rt-1" },
        { id: "d2", dayOfWeek: 3, routineTemplateId: "rt-2" },
      ],
    });
    expect(statements).toHaveLength(2);
    expect(statements[0].sql).toContain('delete from "training_schedule_days"');
    expect(statements[0].sql).toContain('"training_schedule_id" = $1');
    expect(statements[0].params).toEqual(["sch-1"]);
    expect(statements[1].sql).toContain('insert into "training_schedule_days"');
    expect(statements[1].params).toEqual(
      expect.arrayContaining([
        "d1",
        "sch-1",
        1,
        "rt-1",
        "d2",
        "sch-1",
        3,
        "rt-2",
      ]),
    );
  });

  it("replaceScheduleDayRecords deletes without inserting when days is empty", async () => {
    const { db, statements } = renderingDb([]);
    await replaceScheduleDayRecords(db, { scheduleId: "sch-1", days: [] });
    expect(statements).toHaveLength(1);
    expect(statements[0].sql).toContain('delete from "training_schedule_days"');
  });

  it("setActiveSchedule renders three statements in order: own the target, clear siblings, then set it", async () => {
    const { db, statements } = renderingDb([{ id: "sch-1" }]);
    const activated = await setActiveSchedule(db, {
      playerId: "p1",
      scheduleId: "sch-1",
    });
    expect(activated).toBe(true);
    expect(statements).toHaveLength(3);
    expect(statements[0].sql).toContain("select");
    expect(statements[0].sql).toContain('"training_schedules"');
    expect(statements[0].sql).toMatch(/"id" = \$\d+ and .*"player_id" = \$\d+/);
    expect(statements[0].params).toEqual(
      expect.arrayContaining(["sch-1", "p1"]),
    );
    expect(statements[1].sql).toContain('update "training_schedules"');
    expect(statements[1].sql).not.toMatch(/"id" = /);
    expect(statements[1].params).toEqual(expect.arrayContaining([false, "p1"]));
    expect(statements[2].sql).toContain('update "training_schedules"');
    expect(statements[2].sql).toMatch(/"id" = \$\d+ and .*"player_id" = \$\d+/);
    expect(statements[2].params).toEqual(
      expect.arrayContaining([true, "sch-1", "p1"]),
    );
  });

  it("setActiveSchedule writes nothing when the schedule is not the caller's", async () => {
    const { db, statements } = renderingDb([]);
    const activated = await setActiveSchedule(db, {
      playerId: "p1",
      scheduleId: "not-mine",
    });
    expect(activated).toBe(false);
    expect(statements).toHaveLength(1);
    expect(statements[0].sql).not.toContain("update");
  });

  it("clearActiveSchedule deactivates the caller's own schedule", async () => {
    const { db, statements } = renderingDb([{ id: "sch-1" }]);
    const cleared = await clearActiveSchedule(db, {
      playerId: "p1",
      scheduleId: "sch-1",
    });
    expect(cleared).toBe(true);
    expect(statements).toHaveLength(1);
    expect(statements[0].sql).toContain('update "training_schedules"');
    expect(statements[0].sql).toMatch(/"id" = \$\d+ and .*"player_id" = \$\d+/);
  });

  it("deleteScheduleRecord returns false when nothing matched", async () => {
    const { db, statements } = renderingDb([]);
    const deleted = await deleteScheduleRecord(db, "sch-1", "p1");
    expect(deleted).toBe(false);
    expect(onlyStatement(statements)).toContain(
      'delete from "training_schedules"',
    );
  });
});
