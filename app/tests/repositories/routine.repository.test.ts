import { describe, it, expect } from "vitest";
import { renderingDb, onlyStatement } from "./render-sql";
import {
  findRoutineExecutionRows,
  findExerciseTemplateCatalog,
  findDurationTypeId,
  deleteRoutineTemplateRecord,
  deleteRoutineStepRecords,
  updateRoutineTemplateRecord,
  insertRoutineTemplateRecord,
  insertRoutineStepRecords,
} from "@repositories/routine.repository";

describe("findRoutineExecutionRows", () => {
  it("reads v_routine_execution scoped to system rows or the caller's own", async () => {
    const { db, statements } = renderingDb([]);
    await findRoutineExecutionRows(db, "p1");
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_routine_execution"');
    expect(sql).toMatch(/"is_system_template" = \$1 or .*"player_id" = \$2/);
    expect(statements[0].params).toEqual([true, "p1"]);
    expect(sql).toMatch(
      /order by .*"is_system_template" desc.*"routine_name".*"sequence_number"/,
    );
  });

  it("adds the routine id predicate when one is given", async () => {
    const { db, statements } = renderingDb([]);
    await findRoutineExecutionRows(db, "p1", "rt-9");
    expect(onlyStatement(statements)).toContain('"routine_id" = $1');
    expect(statements[0].params).toEqual(["rt-9", true, "p1"]);
  });
});

describe("findExerciseTemplateCatalog", () => {
  it("reads v_exercise_template_catalog ordered by name", async () => {
    const { db, statements } = renderingDb([]);
    await findExerciseTemplateCatalog(db);
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_exercise_template_catalog"');
    expect(sql).toMatch(/order by .*"name"/);
  });
});

describe("findDurationTypeId", () => {
  it("looks up duration_types by implementation key", async () => {
    const { db, statements } = renderingDb([[2]]);
    const id = await findDurationTypeId(db, "MINUTES");
    expect(id).toBe(2);
    const sql = onlyStatement(statements);
    expect(sql).toContain('"duration_types"');
    expect(statements[0].params).toEqual(["MINUTES", 1]);
  });

  it("returns undefined for an unknown key", async () => {
    const { db } = renderingDb([]);
    expect(await findDurationTypeId(db, "UNKNOWN")).toBeUndefined();
  });
});

describe("writes", () => {
  it("insertRoutineTemplateRecord inserts a non-system routine owned by the caller", async () => {
    const { db, statements } = renderingDb([]);
    await insertRoutineTemplateRecord(db, {
      routineId: "rt-1",
      playerId: "p1",
      name: "Mine",
      description: null,
    });
    const sql = onlyStatement(statements);
    expect(sql).toContain('insert into "routine_templates"');
    expect(statements[0].params).toContain(false);
    expect(statements[0].params).toEqual(
      expect.arrayContaining(["rt-1", "p1", "Mine", false]),
    );
  });

  it("deleteRoutineStepRecords deletes every step for the routine", async () => {
    const { db, statements } = renderingDb([]);
    await deleteRoutineStepRecords(db, "rt-1");
    const sql = onlyStatement(statements);
    expect(sql).toContain('delete from "routine_steps"');
    expect(sql).toContain('"routine_template_id" = $1');
    expect(statements[0].params).toEqual(["rt-1"]);
  });

  it("updateRoutineTemplateRecord targets the caller's non-system routine only", async () => {
    const { db, statements } = renderingDb([{ id: "rt-1" }]);
    const updated = await updateRoutineTemplateRecord(db, {
      routineId: "rt-1",
      playerId: "p1",
      name: "Mine",
      description: null,
    });
    const sql = onlyStatement(statements);
    expect(updated).toBe(true);
    expect(sql).toContain('update "routine_templates"');
    expect(sql).toMatch(
      /"id" = \$\d+ and .*"player_id" = \$\d+ and .*"is_system_template" = \$\d+/,
    );
    expect(statements[0].params).toContain(false);
  });

  it("deleteRoutineTemplateRecord returns false when nothing matched", async () => {
    const { db, statements } = renderingDb([]);
    const deleted = await deleteRoutineTemplateRecord(db, "rt-1", "p1");
    expect(deleted).toBe(false);
    expect(onlyStatement(statements)).toContain(
      'delete from "routine_templates"',
    );
  });

  it("insertRoutineStepRecords numbers steps from array position", async () => {
    const { db, statements } = renderingDb([]);
    await insertRoutineStepRecords(db, {
      routineId: "rt-1",
      durationTypeId: 2,
      steps: [
        { id: "s1", exerciseTemplateId: "et-1", durationValue: 10 },
        { id: "s2", exerciseTemplateId: "et-2", durationValue: 20 },
      ],
    });
    const sql = onlyStatement(statements);
    expect(sql).toContain('insert into "routine_steps"');
    expect(statements[0].params).toEqual(
      expect.arrayContaining(["s1", "et-1", 1, 2, 10, "s2", "et-2", 2, 20]),
    );
  });
});
