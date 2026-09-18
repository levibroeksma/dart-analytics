# Custom Routine Builder (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A player composes, saves, edits, deletes and *runs* their own 30–60 minute routine from the four seeded exercise templates; `/training` lists system and own routines from the API.

**Architecture:** One migration (`0038`) adds the ownership `CHECK`, the deferred duration-bound trigger (D305), recreates `v_routine_execution` with owner columns and adds `v_exercise_template_catalog`. A new `routine.service.ts`/`routine.repository.ts` pair behind `/api/routines` and `/api/exercise-templates` (D306). `POST /api/training-sessions` starts by `routineTemplateId` (D320). The play page becomes data-driven; the builder is one Alpine data factory over three Astro components.

**Tech Stack:** PostgreSQL (dbmate migrations, plpgsql constraint trigger), drizzle-orm, Astro server endpoints, Zod, Alpine.js, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-18-custom-routine-builder-design.md` (Phase 1). Corrections it rests on: `docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md` §8, D320.

## Global Constraints

- Branch off `main`, named `feat/custom-routine-builder`. Never commit to `main`. Commit per task step as written; do not open the PR until the user asks.
- Never edit migrations `0001`–`0037` or seeds `0001`–`0019`. New schema = `database/migrations/0038_custom_routines.sql`; new content = `database/seeds/0020_finishing_default_configuration.sql`. If another migration lands on `main` first, renumber to the chain head before merging.
- Ids: `generateId()` (UUIDv7) in the service. The database never generates ids.
- Reads through `v_routine_execution` / `v_exercise_template_catalog`; lookup tables (`duration_types`) may be read directly, as `session.repository.ts` reads `capture_modes`. Writes to `routine_templates`/`routine_steps` inside `withTransaction`.
- Error codes come from the closed registry (`app/src/lib/server/errors.ts`): a foreign routine is `NOT_FOUND`; a system routine on a write is `VALIDATION_FAILED` with `details.reason = "system routine is read-only"`; there is no 403 (D320).
- User steps are `MINUTES` only; `durationValue` integer 1–60; 1–12 steps; name trimmed 1–60 chars; description ≤ 280 or `null`; total `MINUTES` 30–60. Constants live once, in `app/src/pages/api/routines/types.ts` (Zod) and `routine-duration.module.ts` (total).
- TDD per `app/CLAUDE.md` §Test-Driven Development: failing test first, `npm test` from `app/`, then code. No `//` comments inside function bodies; doc comments cite, never narrate (D255).
- Every new `.ts` under `app/src/` has a test under `app/tests/` mirroring its path (`scripts/check-test-coverage.sh`).
- Type declarations live in the folder's `types.ts`/`interfaces.ts` barrel and are consumed via the area root alias (`scripts/check-type-barrels.sh`).
- Before the PR: `cd app && npm run format`, then the `run-all-gates` skill.

## Resolved judgement calls (spec **[decide]** items; the user may overrule before execution)

| Item | Resolution |
| --- | --- |
| Reorder mechanism (spec §6.3) | move-up / move-down `IconBtn`s; no `@alpinejs/sort` |
| Step cap (§4.2) | 12 |
| Default minutes when a step is added (§6.2) | 5 |
| Name uniqueness (§9) | none; the id is the key |
| GAME step bound | 3–30 minutes (`tuodDurationBounds("MINUTES")`), validated at write and at start |

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `database/migrations/0038_custom_routines.sql` | ownership `CHECK`, `fn_routine_templates_duration_bounds()` + two deferred constraint triggers, recreate `v_routine_execution`, create `v_exercise_template_catalog` |
| `database/seeds/0020_finishing_default_configuration.sql` | Finishing template gets TUOD defaults |
| `database/verification/0038_custom_routine_checks.sql` | proves the trigger and the check against a live database |
| `app/src/db/schema.ts` | `vRoutineExecution` gains three columns; new `vExerciseTemplateCatalog` (body text identical to the migration — `schema-view-drift.test.ts`) |
| `app/src/modules/training/routines/routine-duration.module.ts` | `validateRoutineDuration(steps, options?)` gains `minMinutes` |
| `app/src/repositories/routine.repository.ts` | view reads; template/step writes |
| `app/src/repositories/interfaces.ts` | `RoutineExecutionRow`, `ExerciseTemplateCatalogRow` |
| `app/src/services/routine.service.ts` | list / get / create / replace / delete; validation; grouping; trigger-error classification |
| `app/src/services/types.ts` | `RoutineSummary`, `RoutineStep`, `RoutineExecution`, `RoutineWriteInput` |
| `app/src/services/training-session.service.ts` | start by id; GAME config validated; TUOD duration keys injected |
| `app/src/repositories/training-session.repository.ts` | `findRoutineTemplateSteps(db, routineTemplateId, playerId)` returns `routineName` too |
| `app/src/pages/api/routines/{index,[routineId],types}.ts` | controllers + Zod contracts |
| `app/src/pages/api/exercise-templates/{index,types}.ts` | catalog read |
| `app/src/pages/api/types.ts` | barrel raises the two new `types.ts` |
| `app/src/pages/api/training-sessions/types.ts` | `StartTrainingRequest = { routineTemplateId }`; response gains `routineTemplateId` |
| `app/src/lib/client/api/routines.ts`, `types.ts` | client calls; barrel re-exports |
| `app/src/lib/training/routines/routine-route.ts` | `routineIdFromLocation()` — the `?routine=<id>` reader |
| `app/src/lib/training/routines/routine-play.data.ts` | was `balanced-training-play.data.ts`; starts by id from the URL |
| `app/src/lib/training/routines/routine-detail.data.ts` | detail page state (fetch, delete) |
| `app/src/lib/training/routines/training-index.data.ts` | `/training` list state |
| `app/src/lib/training/routines/routine-builder.data.ts` | builder state and save |
| `app/src/lib/training/routines/types.ts` | `RoutinePlayContext` (renamed), builder/detail context types |
| `app/src/lib/client/alpine/register-route-data.ts` | registers the four factories |
| `app/src/pages/training/index.astro` | data-driven list |
| `app/src/pages/training/routines/{detail,play,new,edit}/index.astro` | the four shells |
| `app/src/components/layout/training/routines/RoutineDetail.astro` | Alpine-bound (was static props) |
| `app/src/components/layout/training/routines/{RoutineBuilder,RoutineStepRow,ExercisePicker}.astro` | builder UI |
| tests | one per file above under `app/tests/…` |

---

### Task 1: Migration `0038`, seed `0020`, verification, `schema.ts`

**Files:**
- Create: `database/migrations/0038_custom_routines.sql`
- Create: `database/seeds/0020_finishing_default_configuration.sql`
- Create: `database/verification/0038_custom_routine_checks.sql`
- Modify: `app/src/db/schema.ts` (`vRoutineExecution`; add `vExerciseTemplateCatalog`)
- Test: `app/tests/db/schema-view-drift.test.ts` (existing; goes red when the chain changes and `schema.ts` does not)

**Interfaces:**
- Produces: view columns `v_routine_execution.player_id`, `routine_description`, `exercise_description`; view `v_exercise_template_catalog(exercise_template_id, name, description, exercise_type_key, game_type_key, has_default_configuration)`; trigger error `ERRCODE 23514` with `CONSTRAINT = 'trg_routine_templates_duration_bounds'` (Task 4 matches on it).

- [ ] **Step 1: Cut the branch**

```bash
git checkout main && git pull
git checkout -b feat/custom-routine-builder
```

- [ ] **Step 2: Write the verification script first (it is the migration's test)**

Create `database/verification/0038_custom_routine_checks.sql`:

```sql
-- ============================================================
-- Verification: 0038_custom_routine_checks.sql
--
-- Proves against a live database (D193) what migration 0038 and
-- seed 0020 only claim: a user routine outside 30-60 MINUTES is
-- refused at commit, a system routine is not, an ownerless user
-- routine is refused, and the catalog view lists exactly the four
-- system templates with defaults after 0020.
--
-- The duration trigger is DEFERRABLE INITIALLY DEFERRED and this
-- script never commits, so each case forces it with
-- SET CONSTRAINTS ... IMMEDIATE inside its own sub-block.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0038_custom_routine_checks.sql
--
-- Expected: every result row reads PASS.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES ('01999300-0000-7000-8000-0000000000f1', 'verify-0038', 'Verify 0038', now(), now());

-- 1. ownerless user routine is refused by the CHECK
DO $$
BEGIN
    BEGIN
        INSERT INTO routine_templates (id, player_id, name, description, is_system_template, created_at, updated_at)
        VALUES ('01999400-0000-7000-8000-0000000000f1', NULL, 'Ownerless', NULL, FALSE, now(), now());
        INSERT INTO verification_results VALUES ('1', 'chk_routine_templates_player_ownership rejects a user routine with no owner', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('1', 'chk_routine_templates_player_ownership rejects a user routine with no owner', 'PASS', NULL);
    END;
END $$;

-- helper: a user routine with one Switching step of N minutes
CREATE TEMP FUNCTION IF NOT EXISTS verify_routine(p_id UUID, p_minutes INTEGER) RETURNS void
LANGUAGE plpgsql AS $fn$
BEGIN
    INSERT INTO routine_templates (id, player_id, name, description, is_system_template, created_at, updated_at)
    VALUES (p_id, '01999300-0000-7000-8000-0000000000f1', 'Verify ' || p_minutes, NULL, FALSE, now(), now());
    INSERT INTO routine_steps (id, routine_template_id, exercise_template_id, sequence_number, duration_type_id, duration_value, configuration, created_at)
    VALUES (gen_random_uuid(), p_id, '0199b000-0000-7000-8000-000000000002', 1,
            (SELECT id FROM duration_types WHERE implementation_key = 'MINUTES'), p_minutes, NULL, now());
    SET CONSTRAINTS trg_routine_steps_duration_bounds, trg_routine_templates_duration_bounds IMMEDIATE;
END;
$fn$;

DO $$
BEGIN
    BEGIN
        PERFORM verify_routine('01999400-0000-7000-8000-0000000000f2', 25);
        INSERT INTO verification_results VALUES ('2', 'a 25-minute user routine is refused', 'FAIL', 'commit-time check passed');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('2', 'a 25-minute user routine is refused', 'PASS', NULL);
    END;
END $$;

DO $$
BEGIN
    BEGIN
        PERFORM verify_routine('01999400-0000-7000-8000-0000000000f3', 65);
        INSERT INTO verification_results VALUES ('3', 'a 65-minute user routine is refused', 'FAIL', 'commit-time check passed');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('3', 'a 65-minute user routine is refused', 'PASS', NULL);
    END;
END $$;

DO $$
BEGIN
    BEGIN
        PERFORM verify_routine('01999400-0000-7000-8000-0000000000f4', 30);
        INSERT INTO verification_results VALUES ('4', 'a 30-minute user routine is accepted', 'PASS', NULL);
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('4', 'a 30-minute user routine is accepted', 'FAIL', SQLERRM);
    END;
END $$;

DO $$
BEGIN
    BEGIN
        PERFORM verify_routine('01999400-0000-7000-8000-0000000000f5', 60);
        INSERT INTO verification_results VALUES ('5', 'a 60-minute user routine is accepted', 'PASS', NULL);
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('5', 'a 60-minute user routine is accepted', 'FAIL', SQLERRM);
    END;
END $$;

-- 6. a user routine with no steps is refused by the template trigger
DO $$
BEGIN
    BEGIN
        INSERT INTO routine_templates (id, player_id, name, description, is_system_template, created_at, updated_at)
        VALUES ('01999400-0000-7000-8000-0000000000f6', '01999300-0000-7000-8000-0000000000f1', 'Stepless', NULL, FALSE, now(), now());
        SET CONSTRAINTS trg_routine_templates_duration_bounds IMMEDIATE;
        INSERT INTO verification_results VALUES ('6', 'a stepless user routine is refused', 'FAIL', 'commit-time check passed');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('6', 'a stepless user routine is refused', 'PASS', NULL);
    END;
END $$;

-- 7. the seeded 5-minute system Warm-Up routine is untouched by the bound
INSERT INTO verification_results
SELECT '7', 'system Warm-Up routine (5 min) still exists under the trigger',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END, format('%s row(s)', count(*))
FROM routine_templates WHERE id = '0199c000-0000-7000-8000-000000000001' AND is_system_template;

-- 8. deleting a user routine cascades its steps without tripping the trigger
DO $$
BEGIN
    BEGIN
        DELETE FROM routine_templates WHERE id = '01999400-0000-7000-8000-0000000000f4';
        SET CONSTRAINTS trg_routine_steps_duration_bounds IMMEDIATE;
        INSERT INTO verification_results VALUES ('8', 'deleting a user routine does not trip the bound on its cascaded steps', 'PASS', NULL);
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('8', 'deleting a user routine does not trip the bound on its cascaded steps', 'FAIL', SQLERRM);
    END;
END $$;

-- 9. view columns
INSERT INTO verification_results
SELECT '9', 'v_routine_execution exposes player_id, routine_description, exercise_description',
    CASE WHEN count(*) = 3 THEN 'PASS' ELSE 'FAIL' END, format('%s of 3 columns', count(*))
FROM information_schema.columns
WHERE table_name = 'v_routine_execution'
    AND column_name IN ('player_id', 'routine_description', 'exercise_description');

-- 10. catalog after seed 0020
INSERT INTO verification_results
SELECT '10', 'v_exercise_template_catalog lists four system templates, all with defaults',
    CASE WHEN count(*) = 4 AND bool_and(has_default_configuration) THEN 'PASS' ELSE 'FAIL' END,
    format('%s rows, all defaults: %s', count(*), bool_and(has_default_configuration))
FROM v_exercise_template_catalog;

SELECT step, result, check_name, detail FROM verification_results ORDER BY step::int, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
```

- [ ] **Step 3: Run it against the dev database to see it fail on the current chain (if `DATABASE_URL` is available)**

```bash
cd app && npm run env:dev && cd ..
psql "$(grep '^DATABASE_URL=' app/.env | cut -d= -f2-)" -f database/verification/0038_custom_routine_checks.sql
```

Expected: errors / FAIL rows (no trigger, no view columns). No database in this container → record "not run locally" in the task notes and continue; CI cannot run it either (D193), the script is the artifact.

- [ ] **Step 4: Write the migration**

Create `database/migrations/0038_custom_routines.sql`:

```sql
-- ============================================================
-- Migration: 0038_custom_routines.sql
--
-- Purpose:
-- Make player-authored routines representable and bounded
-- (D305, D306, D320; 09-Training/01-Routines.md §7, §20).
--
-- 1. chk_routine_templates_player_ownership: a system routine has
--    no owner and a user routine always has one. Stricter than
--    chk_configuration_templates_system_ownership on purpose — a
--    user routine with no owner is a row nobody can list, edit or
--    delete.
-- 2. The 30–60 minute bound for user routines is a cross-row
--    aggregate, which no CHECK can express, so it is the chain's
--    first constraint trigger: deferred to commit so the builder's
--    update → delete steps → insert steps is checked once. Only
--    MINUTES steps count (ROUNDS have no wall-clock length,
--    matching routine-duration.module.ts). System routines are
--    exempt: the seeded 5-minute Warm-Up stays valid. A second
--    trigger on routine_templates catches a user routine created
--    with no steps at all, which the steps trigger would never see.
--    Raised with ERRCODE check_violation and the trigger's name as
--    CONSTRAINT so the service can map it to VALIDATION_FAILED.
-- 3. v_routine_execution recreated (0036 shape) with player_id,
--    routine_description and exercise_description, so the list and
--    detail reads stay view-backed and owner-aware.
-- 4. v_exercise_template_catalog: what the builder's picker reads.
--
-- Never edits 0004/0011/0036.
-- ============================================================

-- migrate:up
ALTER TABLE routine_templates
    ADD CONSTRAINT chk_routine_templates_player_ownership CHECK (
        (is_system_template AND player_id IS NULL)
        OR (NOT is_system_template AND player_id IS NOT NULL)
    );

CREATE FUNCTION fn_routine_templates_duration_bounds() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_routine_template_id UUID;
    v_is_system BOOLEAN;
    v_total INTEGER;
BEGIN
    IF TG_TABLE_NAME = 'routine_steps' THEN
        v_routine_template_id := COALESCE(NEW.routine_template_id, OLD.routine_template_id);
    ELSE
        v_routine_template_id := NEW.id;
    END IF;

    SELECT is_system_template INTO v_is_system
    FROM routine_templates
    WHERE id = v_routine_template_id;
    IF NOT FOUND OR v_is_system THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(SUM(rs.duration_value), 0) INTO v_total
    FROM routine_steps rs
        JOIN duration_types dt ON dt.id = rs.duration_type_id
    WHERE rs.routine_template_id = v_routine_template_id
        AND dt.implementation_key = 'MINUTES';

    IF v_total < 30 OR v_total > 60 THEN
        RAISE EXCEPTION 'user routine % is % minutes; the bound is 30-60', v_routine_template_id, v_total
            USING ERRCODE = 'check_violation',
                  CONSTRAINT = 'trg_routine_templates_duration_bounds',
                  TABLE = 'routine_templates';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_routine_steps_duration_bounds
    AFTER INSERT OR UPDATE OR DELETE ON routine_steps
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_routine_templates_duration_bounds();

CREATE CONSTRAINT TRIGGER trg_routine_templates_duration_bounds
    AFTER INSERT OR UPDATE OF is_system_template ON routine_templates
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_routine_templates_duration_bounds();

COMMENT ON FUNCTION fn_routine_templates_duration_bounds() IS 'Deferred bound for user routines: the sum of MINUTES steps must be 30-60 (D305). System routines are exempt. Raises check_violation with CONSTRAINT trg_routine_templates_duration_bounds.';

DROP VIEW IF EXISTS v_routine_execution;
CREATE VIEW v_routine_execution AS
SELECT rt.id AS routine_id,
    rt.name AS routine_name,
    rt.is_system_template,
    rt.player_id,
    rt.description AS routine_description,
    rs.sequence_number,
    et.id   AS exercise_template_id,
    et.name AS exercise_name,
    et.description AS exercise_description,
    ext.implementation_key AS exercise_type_key,
    erv.implementation_key AS exercise_ruleset_version_key,
    gt.implementation_key AS game_type_key,
    rs.duration_value,
    dt.implementation_key AS duration_type_key,
    et.default_configuration,
    rs.configuration AS step_configuration
FROM routine_templates rt
    JOIN routine_steps rs      ON rs.routine_template_id = rt.id
    JOIN exercise_templates et ON et.id = rs.exercise_template_id
    JOIN exercise_types ext    ON ext.id = et.exercise_type_id
    JOIN duration_types dt     ON dt.id = rs.duration_type_id
    LEFT JOIN game_types gt    ON gt.id = et.game_type_id
    LEFT JOIN exercise_ruleset_versions erv ON erv.id = et.exercise_ruleset_version_id;
COMMENT ON VIEW v_routine_execution IS 'Ordered routine execution definition, carrying everything a step resolves from plus the routine''s owner (player_id, NULL for a system routine) and both descriptions (0038). game_type_key and exercise_ruleset_version_key are NULL for a non-game and a game step respectively.';

CREATE VIEW v_exercise_template_catalog AS
SELECT et.id AS exercise_template_id,
    et.name,
    et.description,
    ext.implementation_key AS exercise_type_key,
    gt.implementation_key  AS game_type_key,
    et.default_configuration IS NOT NULL AS has_default_configuration
FROM exercise_templates et
    JOIN exercise_types ext ON ext.id = et.exercise_type_id
    LEFT JOIN game_types gt ON gt.id = et.game_type_id
WHERE et.is_system_template
    AND ext.is_published;
COMMENT ON VIEW v_exercise_template_catalog IS 'System exercise templates a player may compose a routine from. has_default_configuration = FALSE marks a template the service must not offer: its step would resolve to an empty configuration.';

-- migrate:down
DROP VIEW IF EXISTS v_exercise_template_catalog;

DROP VIEW IF EXISTS v_routine_execution;
CREATE VIEW v_routine_execution AS
SELECT rt.id AS routine_id,
    rt.name AS routine_name,
    rt.is_system_template,
    rs.sequence_number,
    et.id   AS exercise_template_id,
    et.name AS exercise_name,
    ext.implementation_key AS exercise_type_key,
    erv.implementation_key AS exercise_ruleset_version_key,
    gt.implementation_key AS game_type_key,
    rs.duration_value,
    dt.implementation_key AS duration_type_key,
    et.default_configuration,
    rs.configuration AS step_configuration
FROM routine_templates rt
    JOIN routine_steps rs      ON rs.routine_template_id = rt.id
    JOIN exercise_templates et ON et.id = rs.exercise_template_id
    JOIN exercise_types ext    ON ext.id = et.exercise_type_id
    JOIN duration_types dt     ON dt.id = rs.duration_type_id
    LEFT JOIN game_types gt    ON gt.id = et.game_type_id
    LEFT JOIN exercise_ruleset_versions erv ON erv.id = et.exercise_ruleset_version_id;
COMMENT ON VIEW v_routine_execution IS 'Ordered routine execution definition, carrying everything a step resolves from: its exercise type, the exercise ruleset version its template pins (0035), the template default configuration and the step override. game_type_key and exercise_ruleset_version_key are NULL for a non-game and a game step respectively.';

DROP TRIGGER IF EXISTS trg_routine_templates_duration_bounds ON routine_templates;
DROP TRIGGER IF EXISTS trg_routine_steps_duration_bounds ON routine_steps;
DROP FUNCTION IF EXISTS fn_routine_templates_duration_bounds();

ALTER TABLE routine_templates
    DROP CONSTRAINT IF EXISTS chk_routine_templates_player_ownership;
```

Note for the executor: the trigger only reads `NEW.routine_template_id` (or `OLD` on delete). An `UPDATE` that moves a step to another routine would check only the destination; the service never issues one (replace = delete + insert). State that in the migration header if you shorten it.

- [ ] **Step 5: Write the seed**

Create `database/seeds/0020_finishing_default_configuration.sql`:

```sql
-- database/seeds/0020_finishing_default_configuration.sql
--
-- ============================================================
-- Seed: 0020_finishing_default_configuration.sql
--
-- Purpose:
-- Give the Finishing (TUOD) system template a default_configuration
-- so a player can pick it in the routine builder (D320). Until now
-- the template carried NULL and Balanced Training's step 4 supplied
-- the whole configuration; a user step carries no configuration, so
-- it would resolve to {} and fail TUOD validation at start.
--
-- Values are Balanced Training's own (seed 0017). duration_value is
-- overwritten per step by startTraining from the step's minutes, so
-- the 10 here is a default, not a rule.
--
-- UPDATE in place, the 0017/0019 shape: idempotent under re-run.
-- ============================================================
BEGIN;

UPDATE exercise_templates
SET default_configuration = '{
        "starting_target": 41,
        "finish_bonus": 10,
        "miss_penalty": 1,
        "duration_type": "MINUTES",
        "duration_value": 10,
        "max_darts_per_turn": 3
    }'::jsonb,
    updated_at = now()
WHERE id = '0199b000-0000-7000-8000-000000000004';

COMMIT;
```

- [ ] **Step 6: Mirror the views in `schema.ts`**

Preferred: with a database, `cd app && npm run db:migrate && npm run db:introspect`, commit only `app/src/db/schema.ts`. Without one, edit by hand:

1. In the `vRoutineExecution = pgView("v_routine_execution", { … })` column map add, after `isSystemTemplate`:
   ```ts
   playerId: uuid("player_id"),
   routineDescription: text("routine_description"),
   ```
   and after `exerciseName`:
   ```ts
   exerciseDescription: text("exercise_description"),
   ```
2. Replace its `.as(sql\`…\`)` body with the `SELECT … ;` text of the new `CREATE VIEW v_routine_execution` above (everything between `AS` and `;`, comments stripped).
3. Add, following the same shape as the neighbouring views:
   ```ts
   export const vExerciseTemplateCatalog = pgView("v_exercise_template_catalog", {
     exerciseTemplateId: uuid("exercise_template_id"),
     name: text(),
     description: text(),
     exerciseTypeKey: text("exercise_type_key"),
     gameTypeKey: text("game_type_key"),
     hasDefaultConfiguration: boolean("has_default_configuration"),
   }).as(sql`SELECT et.id AS exercise_template_id, et.name, et.description, ext.implementation_key AS exercise_type_key, gt.implementation_key AS game_type_key, et.default_configuration IS NOT NULL AS has_default_configuration FROM exercise_templates et JOIN exercise_types ext ON ext.id = et.exercise_type_id LEFT JOIN game_types gt ON gt.id = et.game_type_id WHERE et.is_system_template AND ext.is_published`);
   ```
   Match the whitespace normalisation the existing `.as()` bodies use (the drift test normalises whitespace; check `schemaViewBodies()` in `app/tests/db/schema-view-drift.test.ts` if it fails).

- [ ] **Step 7: Run the suite**

```bash
cd app && npm test -- tests/db
```

Expected: `schema-view-drift.test.ts` and `read-model-non-game-sessions.test.ts` PASS (the new view LEFT JOINs `game_types`).

- [ ] **Step 8: Commit**

```bash
git add database/migrations/0038_custom_routines.sql database/seeds/0020_finishing_default_configuration.sql database/verification/0038_custom_routine_checks.sql app/src/db/schema.ts
git commit -m "feat(db): 0038 custom routines — ownership check, duration-bound trigger, owner-aware views; seed 0020 Finishing defaults"
```

---

### Task 2: `validateRoutineDuration` floor option

**Files:**
- Modify: `app/src/modules/training/routines/routine-duration.module.ts`
- Modify: `app/src/modules/training/routines/types.ts` (add `RoutineDurationOptions`)
- Test: `app/tests/modules/training/routines/routine-duration.module.test.ts`

**Interfaces:**
- Produces: `validateRoutineDuration(steps, options?: { minMinutes?: number; maxMinutes?: number })`; `MIN_USER_ROUTINE_MINUTES = 30`. Tasks 4 and 8 call it with `{ minMinutes: MIN_USER_ROUTINE_MINUTES }`.

- [ ] **Step 1: Add failing tests**

Append inside the `describe("validateRoutineDuration")` block:

```ts
  it("exports the user-routine floor", () => {
    expect(MIN_USER_ROUTINE_MINUTES).toBe(30);
  });

  it("rejects a routine under the floor when one is given", () => {
    const result = validateRoutineDuration([minutes(1, 29)], {
      minMinutes: MIN_USER_ROUTINE_MINUTES,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("minimum is 30");
  });

  it("accepts exactly the floor and exactly the cap under the floor option", () => {
    expect(
      validateRoutineDuration([minutes(1, 30)], { minMinutes: 30 }),
    ).toEqual({ ok: true, totalMinutes: 30 });
    expect(
      validateRoutineDuration([minutes(1, 60)], { minMinutes: 30 }),
    ).toEqual({ ok: true, totalMinutes: 60 });
  });

  it("rejects over the cap under the floor option", () => {
    expect(
      validateRoutineDuration([minutes(1, 61)], { minMinutes: 30 }).ok,
    ).toBe(false);
  });

  it("counts ROUNDS as zero against the floor too", () => {
    const result = validateRoutineDuration(
      [{ sequenceNumber: 1, durationTypeKey: "ROUNDS", durationValue: 40 }],
      { minMinutes: 30 },
    );

    expect(result.ok).toBe(false);
  });
```

Update the import to include `MIN_USER_ROUTINE_MINUTES`.

- [ ] **Step 2: Run to see them fail**

```bash
cd app && npm test -- tests/modules/training/routines/routine-duration.module.test.ts
```

Expected: FAIL — `MIN_USER_ROUTINE_MINUTES` undefined; the 29-minute case returns `ok: true`.

- [ ] **Step 3: Implement**

In `app/src/modules/training/routines/types.ts` add:

```ts
export type RoutineDurationOptions = {
  /** Inclusive floor on the MINUTES total; 0 disables it. */
  minMinutes?: number;
  /** Inclusive cap on the MINUTES total; defaults to MAX_ROUTINE_MINUTES. */
  maxMinutes?: number;
};
```

In `routine-duration.module.ts`, replace the doc comment's sentence "and the repository uses no triggers" with "and is enforced at commit by `trg_routine_steps_duration_bounds` (migration `0038`); this module is the shared pre-validation both the builder and the service run", then:

```ts
export const MAX_ROUTINE_MINUTES = 60;

/** User-authored routines also satisfy a floor (01-Routines.md §7, D305). */
export const MIN_USER_ROUTINE_MINUTES = 30;

export function validateRoutineDuration(
  steps: readonly RoutineStepDuration[],
  options: RoutineDurationOptions = {},
): RoutineDurationResult {
  const minMinutes = options.minMinutes ?? 0;
  const maxMinutes = options.maxMinutes ?? MAX_ROUTINE_MINUTES;
  const issues: string[] = [];
  …existing body unchanged up to totalMinutes…

  if (totalMinutes < minMinutes) {
    issues.push(
      `routine is ${totalMinutes} minutes; the minimum is ${minMinutes}`,
    );
  }
  if (totalMinutes > maxMinutes) {
    issues.push(
      `routine is ${totalMinutes} minutes; the maximum is ${maxMinutes}`,
    );
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, totalMinutes };
}
```

Import `RoutineDurationOptions` from `@modules/types` alongside the two existing types.

- [ ] **Step 4: Run to green**

```bash
cd app && npm test -- tests/modules/training/routines/routine-duration.module.test.ts
```

Expected: all PASS, including the pre-existing cases (default floor 0).

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/training/routines/routine-duration.module.ts app/src/modules/training/routines/types.ts app/tests/modules/training/routines/routine-duration.module.test.ts
git commit -m "feat(routines): validateRoutineDuration gains a minMinutes floor (D305)"
```

---

### Task 3: `routine.repository.ts`

**Files:**
- Create: `app/src/repositories/routine.repository.ts`
- Modify: `app/src/repositories/interfaces.ts`
- Test: `app/tests/repositories/routine.repository.test.ts`

**Interfaces:**
- Produces:
  ```ts
  findRoutineExecutionRows(db, playerId: string, routineId?: string): Promise<RoutineExecutionRow[]>
  findExerciseTemplateCatalog(db): Promise<ExerciseTemplateCatalogRow[]>
  findDurationTypeId(db, implementationKey: string): Promise<number | undefined>
  insertRoutineTemplateRecord(tx, { routineId, playerId, name, description }): Promise<void>
  insertRoutineStepRecords(tx, { routineId, durationTypeId, steps: { id, exerciseTemplateId, durationValue }[] }): Promise<void>
  updateRoutineTemplateRecord(tx, { routineId, playerId, name, description }): Promise<boolean>
  deleteRoutineStepRecords(tx, routineId): Promise<void>
  deleteRoutineTemplateRecord(db, routineId, playerId): Promise<boolean>
  ```

- [ ] **Step 1: Add the row interfaces**

Append to `app/src/repositories/interfaces.ts`:

```ts
/** One `v_routine_execution` row — a step of a routine the caller may see. */
export interface RoutineExecutionRow {
  routineId: string;
  routineName: string;
  routineDescription: string | null;
  isSystemTemplate: boolean;
  playerId: string | null;
  sequenceNumber: number;
  exerciseTemplateId: string;
  exerciseName: string;
  exerciseDescription: string | null;
  exerciseTypeKey: string;
  exerciseRulesetVersionKey: string | null;
  gameTypeKey: string | null;
  durationTypeKey: string;
  durationValue: number;
  defaultConfiguration: unknown;
  stepConfiguration: unknown;
}

/** One `v_exercise_template_catalog` row. */
export interface ExerciseTemplateCatalogRow {
  exerciseTemplateId: string;
  name: string;
  description: string | null;
  exerciseTypeKey: string;
  gameTypeKey: string | null;
  hasDefaultConfiguration: boolean;
}
```

- [ ] **Step 2: Write the failing tests**

Create `app/tests/repositories/routine.repository.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderingDb, onlyStatement } from "./render-sql";
import {
  findRoutineExecutionRows,
  findExerciseTemplateCatalog,
  deleteRoutineTemplateRecord,
  updateRoutineTemplateRecord,
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
    expect(sql).toMatch(/order by .*"is_system_template" desc.*"routine_name".*"sequence_number"/);
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

describe("writes", () => {
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
    expect(sql).toMatch(/"id" = \$\d+ and .*"player_id" = \$\d+ and .*"is_system_template" = \$\d+/);
    expect(statements[0].params).toContain(false);
  });

  it("deleteRoutineTemplateRecord returns false when nothing matched", async () => {
    const { db, statements } = renderingDb([]);
    const deleted = await deleteRoutineTemplateRecord(db, "rt-1", "p1");
    expect(deleted).toBe(false);
    expect(onlyStatement(statements)).toContain('delete from "routine_templates"');
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
```

- [ ] **Step 3: Run to see them fail**

```bash
cd app && npm test -- tests/repositories/routine.repository.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `app/src/repositories/routine.repository.ts`:

```ts
import { and, asc, desc, eq, or } from "drizzle-orm";
import { getDb, withTransaction } from "@db/client";
import {
  durationTypes,
  routineSteps,
  routineTemplates,
  vExerciseTemplateCatalog,
  vRoutineExecution,
} from "@db/schema";
import type {
  ExerciseTemplateCatalogRow,
  RoutineExecutionRow,
} from "./interfaces";

type Db = ReturnType<typeof getDb>;

type Tx = Parameters<typeof withTransaction>[0] extends (tx: infer T) => unknown
  ? T
  : never;

type Writer = Db | Tx;

/**
 * The routines a player may read: every system routine plus their own
 * (`06-API/04-Endpoint-Contracts.md`, D320). A stepless routine has no rows
 * in the view and so reads as absent, which for a user routine the `0038`
 * trigger makes impossible.
 */
export async function findRoutineExecutionRows(
  db: Db,
  playerId: string,
  routineId?: string,
): Promise<RoutineExecutionRow[]> {
  const scope = or(
    eq(vRoutineExecution.isSystemTemplate, true),
    eq(vRoutineExecution.playerId, playerId),
  );
  const rows = await db
    .select({
      routineId: vRoutineExecution.routineId,
      routineName: vRoutineExecution.routineName,
      routineDescription: vRoutineExecution.routineDescription,
      isSystemTemplate: vRoutineExecution.isSystemTemplate,
      playerId: vRoutineExecution.playerId,
      sequenceNumber: vRoutineExecution.sequenceNumber,
      exerciseTemplateId: vRoutineExecution.exerciseTemplateId,
      exerciseName: vRoutineExecution.exerciseName,
      exerciseDescription: vRoutineExecution.exerciseDescription,
      exerciseTypeKey: vRoutineExecution.exerciseTypeKey,
      exerciseRulesetVersionKey: vRoutineExecution.exerciseRulesetVersionKey,
      gameTypeKey: vRoutineExecution.gameTypeKey,
      durationTypeKey: vRoutineExecution.durationTypeKey,
      durationValue: vRoutineExecution.durationValue,
      defaultConfiguration: vRoutineExecution.defaultConfiguration,
      stepConfiguration: vRoutineExecution.stepConfiguration,
    })
    .from(vRoutineExecution)
    .where(
      routineId
        ? and(eq(vRoutineExecution.routineId, routineId), scope)
        : scope,
    )
    .orderBy(
      desc(vRoutineExecution.isSystemTemplate),
      asc(vRoutineExecution.routineName),
      asc(vRoutineExecution.routineId),
      asc(vRoutineExecution.sequenceNumber),
    );
  return rows as RoutineExecutionRow[];
}

export async function findExerciseTemplateCatalog(
  db: Db,
): Promise<ExerciseTemplateCatalogRow[]> {
  const rows = await db
    .select({
      exerciseTemplateId: vExerciseTemplateCatalog.exerciseTemplateId,
      name: vExerciseTemplateCatalog.name,
      description: vExerciseTemplateCatalog.description,
      exerciseTypeKey: vExerciseTemplateCatalog.exerciseTypeKey,
      gameTypeKey: vExerciseTemplateCatalog.gameTypeKey,
      hasDefaultConfiguration: vExerciseTemplateCatalog.hasDefaultConfiguration,
    })
    .from(vExerciseTemplateCatalog)
    .orderBy(asc(vExerciseTemplateCatalog.name));
  return rows as ExerciseTemplateCatalogRow[];
}

export async function findDurationTypeId(
  db: Db,
  implementationKey: string,
): Promise<number | undefined> {
  const [row] = await db
    .select({ id: durationTypes.id })
    .from(durationTypes)
    .where(eq(durationTypes.implementationKey, implementationKey))
    .limit(1);
  return row?.id;
}

export async function insertRoutineTemplateRecord(
  tx: Writer,
  input: {
    routineId: string;
    playerId: string;
    name: string;
    description: string | null;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await tx.insert(routineTemplates).values({
    id: input.routineId,
    playerId: input.playerId,
    name: input.name,
    description: input.description,
    isSystemTemplate: false,
    createdAt: now,
    updatedAt: now,
  });
}

/** `sequence_number` is array position + 1 — never taken from a request. */
export async function insertRoutineStepRecords(
  tx: Writer,
  input: {
    routineId: string;
    durationTypeId: number;
    steps: { id: string; exerciseTemplateId: string; durationValue: number }[];
  },
): Promise<void> {
  const now = new Date().toISOString();
  await tx.insert(routineSteps).values(
    input.steps.map((step, index) => ({
      id: step.id,
      routineTemplateId: input.routineId,
      exerciseTemplateId: step.exerciseTemplateId,
      sequenceNumber: index + 1,
      durationTypeId: input.durationTypeId,
      durationValue: step.durationValue,
      configuration: null,
      createdAt: now,
    })),
  );
}

/** True when the caller's own non-system routine was updated. */
export async function updateRoutineTemplateRecord(
  tx: Writer,
  input: {
    routineId: string;
    playerId: string;
    name: string;
    description: string | null;
  },
): Promise<boolean> {
  const rows = await tx
    .update(routineTemplates)
    .set({
      name: input.name,
      description: input.description,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(routineTemplates.id, input.routineId),
        eq(routineTemplates.playerId, input.playerId),
        eq(routineTemplates.isSystemTemplate, false),
      ),
    )
    .returning({ id: routineTemplates.id });
  return rows.length === 1;
}

export async function deleteRoutineStepRecords(
  tx: Writer,
  routineId: string,
): Promise<void> {
  await tx
    .delete(routineSteps)
    .where(eq(routineSteps.routineTemplateId, routineId));
}

/** Steps cascade (`fk_routine_steps_routine`). True when a row was deleted. */
export async function deleteRoutineTemplateRecord(
  db: Writer,
  routineId: string,
  playerId: string,
): Promise<boolean> {
  const rows = await db
    .delete(routineTemplates)
    .where(
      and(
        eq(routineTemplates.id, routineId),
        eq(routineTemplates.playerId, playerId),
        eq(routineTemplates.isSystemTemplate, false),
      ),
    )
    .returning({ id: routineTemplates.id });
  return rows.length === 1;
}
```

If `schema.ts` exports the tables under other names (`drizzle-kit` camel-cases `duration_types` → `durationTypes`, `routine_steps` → `routineSteps`, `routine_templates` → `routineTemplates`), use those names; do not rename the schema.

- [ ] **Step 5: Run to green; adjust regexes to the rendered SQL if drizzle's quoting differs**

```bash
cd app && npm test -- tests/repositories/routine.repository.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/repositories/routine.repository.ts app/src/repositories/interfaces.ts app/tests/repositories/routine.repository.test.ts
git commit -m "feat(routines): routine.repository — owner-aware view reads and template/step writes"
```

---

### Task 4: `routine.service.ts`

**Files:**
- Create: `app/src/services/routine.service.ts`
- Modify: `app/src/services/types.ts`
- Test: `app/tests/services/routine.service.test.ts`

**Interfaces:**
- Consumes: Task 2 `validateRoutineDuration`, `MIN_USER_ROUTINE_MINUTES`; Task 3 repository functions; `tuodDurationBounds` from `@lib/game/tuod-duration`.
- Produces:
  ```ts
  listRoutines(playerId): Promise<ServiceResult<{ items: RoutineSummary[]; nextCursor: null }>>
  getRoutine(playerId, routineId): Promise<ServiceResult<RoutineExecution>>
  listExerciseTemplates(): Promise<ServiceResult<ExerciseTemplateCatalogEntry[]>>
  createRoutine(playerId, input: RoutineWriteInput): Promise<ServiceResult<RoutineExecution>>
  replaceRoutine(playerId, routineId, input: RoutineWriteInput): Promise<ServiceResult<RoutineExecution>>
  deleteRoutine(playerId, routineId): Promise<ServiceResult<null>>
  ```

- [ ] **Step 1: Add the service types**

Append to `app/src/services/types.ts`:

```ts
export type RoutineStep = {
  sequenceNumber: number;
  exerciseTemplateId: string;
  exerciseName: string;
  exerciseDescription: string | null;
  exerciseTypeKey: string;
  gameTypeKey: string | null;
  durationValue: number;
  durationTypeKey: string;
};

export type RoutineExecution = {
  routineId: string;
  routineName: string;
  description: string | null;
  isSystemTemplate: boolean;
  steps: RoutineStep[];
};

export type RoutineSummary = {
  routineId: string;
  routineName: string;
  description: string | null;
  isSystemTemplate: boolean;
  stepCount: number;
  totalMinutes: number;
};

export type ExerciseTemplateCatalogEntry = {
  exerciseTemplateId: string;
  name: string;
  description: string | null;
  exerciseTypeKey: string;
  gameTypeKey: string | null;
};

export type RoutineWriteInput = {
  name: string;
  description: string | null;
  steps: {
    exerciseTemplateId: string;
    durationTypeKey: "MINUTES";
    durationValue: number;
  }[];
};
```

- [ ] **Step 2: Write the failing tests**

Create `app/tests/services/routine.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@db/client", () => ({
  getDb: vi.fn(() => ({})),
  withTransaction: vi.fn((fn: (tx: unknown) => unknown) => fn({ tx: true })),
}));
vi.mock("@lib/id", () => {
  let n = 0;
  return { generateId: vi.fn(() => `id-${++n}`) };
});
vi.mock("@repositories/routine.repository", () => ({
  findRoutineExecutionRows: vi.fn(),
  findExerciseTemplateCatalog: vi.fn(),
  findDurationTypeId: vi.fn(),
  insertRoutineTemplateRecord: vi.fn(),
  insertRoutineStepRecords: vi.fn(),
  updateRoutineTemplateRecord: vi.fn(),
  deleteRoutineStepRecords: vi.fn(),
  deleteRoutineTemplateRecord: vi.fn(),
}));

import * as repo from "@repositories/routine.repository";
import { withTransaction } from "@db/client";
import {
  listRoutines,
  getRoutine,
  createRoutine,
  replaceRoutine,
  deleteRoutine,
  listExerciseTemplates,
} from "@services/routine.service";

const CATALOG = [
  { exerciseTemplateId: "et-warm", name: "Warm-Up", description: null, exerciseTypeKey: "WARM_UP", gameTypeKey: null, hasDefaultConfiguration: true },
  { exerciseTemplateId: "et-sw", name: "Switching", description: null, exerciseTypeKey: "SWITCHING", gameTypeKey: null, hasDefaultConfiguration: true },
  { exerciseTemplateId: "et-fin", name: "Finishing", description: null, exerciseTypeKey: "GAME", gameTypeKey: "TUOD", hasDefaultConfiguration: true },
  { exerciseTemplateId: "et-nodef", name: "Bare", description: null, exerciseTypeKey: "SWITCHING", gameTypeKey: null, hasDefaultConfiguration: false },
];

function row(over: Partial<Record<string, unknown>>) {
  return {
    routineId: "rt-sys", routineName: "Balanced Training", routineDescription: "d",
    isSystemTemplate: true, playerId: null, sequenceNumber: 1,
    exerciseTemplateId: "et-warm", exerciseName: "Warm-Up", exerciseDescription: "loosen",
    exerciseTypeKey: "WARM_UP", exerciseRulesetVersionKey: "WARM_UP_V1", gameTypeKey: null,
    durationTypeKey: "MINUTES", durationValue: 10, defaultConfiguration: {}, stepConfiguration: null,
    ...over,
  };
}

const VALID = {
  name: "  Mine  ",
  description: null,
  steps: [
    { exerciseTemplateId: "et-warm", durationTypeKey: "MINUTES" as const, durationValue: 10 },
    { exerciseTemplateId: "et-sw", durationTypeKey: "MINUTES" as const, durationValue: 10 },
    { exerciseTemplateId: "et-fin", durationTypeKey: "MINUTES" as const, durationValue: 10 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(repo.findExerciseTemplateCatalog).mockResolvedValue(CATALOG);
  vi.mocked(repo.findDurationTypeId).mockResolvedValue(2);
});

describe("listRoutines", () => {
  it("groups view rows into summaries with derived totalMinutes and stepCount", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([
      row({}),
      row({ sequenceNumber: 2, exerciseTemplateId: "et-sw", durationValue: 5 }),
      row({ routineId: "rt-own", routineName: "Mine", isSystemTemplate: false, playerId: "p1", durationValue: 30 }),
    ] as never);
    const result = await listRoutines("p1");
    expect(result).toEqual({
      ok: true,
      data: {
        items: [
          { routineId: "rt-sys", routineName: "Balanced Training", description: "d", isSystemTemplate: true, stepCount: 2, totalMinutes: 15 },
          { routineId: "rt-own", routineName: "Mine", description: "d", isSystemTemplate: false, stepCount: 1, totalMinutes: 30 },
        ],
        nextCursor: null,
      },
    });
    expect(repo.findRoutineExecutionRows).toHaveBeenCalledWith(expect.anything(), "p1");
  });
});

describe("getRoutine", () => {
  it("returns NOT_FOUND when the view yields nothing (unknown or foreign)", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([]);
    expect(await getRoutine("p1", "rt-x")).toEqual({
      ok: false, code: "NOT_FOUND", details: { routineId: "rt-x" },
    });
  });

  it("returns the routine with ordered steps", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([row({})] as never);
    const result = await getRoutine("p1", "rt-sys");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.steps[0]).toEqual({
      sequenceNumber: 1, exerciseTemplateId: "et-warm", exerciseName: "Warm-Up",
      exerciseDescription: "loosen", exerciseTypeKey: "WARM_UP", gameTypeKey: null,
      durationValue: 10, durationTypeKey: "MINUTES",
    });
  });
});

describe("listExerciseTemplates", () => {
  it("drops templates without a default configuration and the has_* flag", async () => {
    const result = await listExerciseTemplates();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((e) => e.exerciseTemplateId)).toEqual(["et-warm", "et-sw", "et-fin"]);
    expect(result.data[0]).not.toHaveProperty("hasDefaultConfiguration");
  });
});

describe("createRoutine", () => {
  it("rejects an unknown or default-less template with the step index", async () => {
    const result = await createRoutine("p1", {
      ...VALID,
      steps: [{ exerciseTemplateId: "et-nodef", durationTypeKey: "MINUTES", durationValue: 30 }],
    });
    expect(result).toEqual({
      ok: false, code: "VALIDATION_FAILED",
      details: { reason: "unknown exerciseTemplateId", step: 1 },
    });
  });

  it("rejects a total under the floor with the module's issues", async () => {
    const result = await createRoutine("p1", {
      ...VALID,
      steps: [{ exerciseTemplateId: "et-sw", durationTypeKey: "MINUTES", durationValue: 20 }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("VALIDATION_FAILED");
    expect(String((result.details as { issues: string[] }).issues[0])).toContain("minimum is 30");
  });

  it("rejects a GAME step outside TUOD's timed bounds", async () => {
    const result = await createRoutine("p1", {
      ...VALID,
      steps: [
        { exerciseTemplateId: "et-sw", durationTypeKey: "MINUTES", durationValue: 28 },
        { exerciseTemplateId: "et-fin", durationTypeKey: "MINUTES", durationValue: 2 },
      ],
    });
    expect(result).toEqual({
      ok: false, code: "VALIDATION_FAILED",
      details: { reason: "game step minutes out of bounds", step: 2, min: 3, max: 30 },
    });
  });

  it("inserts template then steps in one transaction and reads the routine back", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([
      row({ routineId: "id-1", routineName: "Mine", isSystemTemplate: false, playerId: "p1" }),
    ] as never);
    const result = await createRoutine("p1", VALID);
    expect(result.ok).toBe(true);
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(repo.insertRoutineTemplateRecord).toHaveBeenCalledWith(
      { tx: true },
      { routineId: "id-1", playerId: "p1", name: "Mine", description: null },
    );
    expect(repo.insertRoutineStepRecords).toHaveBeenCalledWith(
      { tx: true },
      expect.objectContaining({
        routineId: "id-1",
        durationTypeId: 2,
        steps: [
          { id: "id-2", exerciseTemplateId: "et-warm", durationValue: 10 },
          { id: "id-3", exerciseTemplateId: "et-sw", durationValue: 10 },
          { id: "id-4", exerciseTemplateId: "et-fin", durationValue: 10 },
        ],
      }),
    );
    expect(repo.findRoutineExecutionRows).toHaveBeenCalledWith(expect.anything(), "p1", "id-1");
  });

  it("maps the 0038 trigger's check_violation to VALIDATION_FAILED", async () => {
    const err = Object.assign(new Error("bound"), {
      code: "23514",
      constraint: "trg_routine_templates_duration_bounds",
    });
    vi.mocked(withTransaction).mockRejectedValueOnce(err);
    const result = await createRoutine("p1", VALID);
    expect(result).toEqual({
      ok: false, code: "VALIDATION_FAILED",
      details: { reason: "routine duration out of bounds" },
    });
  });
});

describe("replaceRoutine", () => {
  it("returns NOT_FOUND for a routine the caller cannot see", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([]);
    expect(await replaceRoutine("p1", "rt-x", VALID)).toEqual({
      ok: false, code: "NOT_FOUND", details: { routineId: "rt-x" },
    });
  });

  it("refuses a system routine as read-only", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([row({})] as never);
    expect(await replaceRoutine("p1", "rt-sys", VALID)).toEqual({
      ok: false, code: "VALIDATION_FAILED",
      details: { reason: "system routine is read-only" },
    });
  });

  it("updates, deletes steps, then inserts steps inside one transaction", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([
      row({ routineId: "rt-own", isSystemTemplate: false, playerId: "p1" }),
    ] as never);
    vi.mocked(repo.updateRoutineTemplateRecord).mockResolvedValue(true);
    const result = await replaceRoutine("p1", "rt-own", VALID);
    expect(result.ok).toBe(true);
    const order = [
      vi.mocked(repo.updateRoutineTemplateRecord).mock.invocationCallOrder[0],
      vi.mocked(repo.deleteRoutineStepRecords).mock.invocationCallOrder[0],
      vi.mocked(repo.insertRoutineStepRecords).mock.invocationCallOrder[0],
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(withTransaction).toHaveBeenCalledTimes(1);
  });
});

describe("deleteRoutine", () => {
  it("refuses a system routine", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([row({})] as never);
    expect(await deleteRoutine("p1", "rt-sys")).toEqual({
      ok: false, code: "VALIDATION_FAILED",
      details: { reason: "system routine is read-only" },
    });
  });

  it("deletes an own routine", async () => {
    vi.mocked(repo.findRoutineExecutionRows).mockResolvedValue([
      row({ routineId: "rt-own", isSystemTemplate: false, playerId: "p1" }),
    ] as never);
    vi.mocked(repo.deleteRoutineTemplateRecord).mockResolvedValue(true);
    expect(await deleteRoutine("p1", "rt-own")).toEqual({ ok: true, data: null });
    expect(repo.deleteRoutineTemplateRecord).toHaveBeenCalledWith(expect.anything(), "rt-own", "p1");
  });
});
```

- [ ] **Step 3: Run to see them fail**

```bash
cd app && npm test -- tests/services/routine.service.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `app/src/services/routine.service.ts`:

```ts
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

/** Step rows of one routine, grouped in view order, into the read DTO. */
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

function offerable(rows: ExerciseTemplateCatalogRow[]) {
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
  const byId = new Map(offerable(catalog).map((row) => [row.exerciseTemplateId, row]));
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
      (step.durationValue < gameBounds.min || step.durationValue > gameBounds.max)
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

async function writeSteps(
  tx: Parameters<Parameters<typeof withTransaction>[0]>[0],
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
  const durationTypeId = await findDurationTypeId(db, USER_STEP_DURATION_TYPE_KEY);
  if (!durationTypeId) {
    return { ok: false, code: "INTERNAL_ERROR", details: { reason: "reference data missing" } };
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
  const durationTypeId = await findDurationTypeId(db, USER_STEP_DURATION_TYPE_KEY);
  if (!durationTypeId) {
    return { ok: false, code: "INTERNAL_ERROR", details: { reason: "reference data missing" } };
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
  const deleted = await deleteRoutineTemplateRecord(getDb(), routineId, playerId);
  return deleted ? { ok: true, data: null } : notFound(routineId);
}
```

- [ ] **Step 5: Run to green**

```bash
cd app && npm test -- tests/services/routine.service.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/services/routine.service.ts app/src/services/types.ts app/tests/services/routine.service.test.ts
git commit -m "feat(routines): routine.service — list/get/create/replace/delete with D306 validation and trigger mapping"
```

---

### Task 5: API routes, Zod contracts, client module

**Files:**
- Create: `app/src/pages/api/routines/types.ts`, `index.ts`, `[routineId].ts`
- Create: `app/src/pages/api/exercise-templates/types.ts`, `index.ts`
- Modify: `app/src/pages/api/types.ts` (barrel), `app/src/lib/client/api/types.ts` (barrel)
- Create: `app/src/lib/client/api/routines.ts`
- Test: `app/tests/pages/api/routines/routines.test.ts`, `app/tests/pages/api/routines/types.test.ts`, `app/tests/pages/api/exercise-templates/exercise-templates.test.ts`, `app/tests/lib/client/api/routines.test.ts`

**Interfaces:**
- Consumes: Task 4 service functions.
- Produces: Zod `CreateRoutineRequest`, `UpdateRoutineRequest`, `RoutineExecutionResponse`, `RoutineListResponse`, `ExerciseTemplateCatalogResponse`; client `listRoutines()`, `getRoutine(id)`, `createRoutine(body)`, `updateRoutine(id, body)`, `deleteRoutine(id)`, `listExerciseTemplates()` (all throw `SessionApiError` on `ok: false`).

- [ ] **Step 1: Failing contract tests**

Create `app/tests/pages/api/routines/types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CreateRoutineRequest } from "@routes/routines/types";

const step = { exerciseTemplateId: "et-1", durationTypeKey: "MINUTES", durationValue: 10 };

describe("CreateRoutineRequest", () => {
  it("accepts a trimmed name, null description and MINUTES steps", () => {
    const parsed = CreateRoutineRequest.safeParse({ name: " A ", steps: [step, step, step] });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.name).toBe("A");
    expect(parsed.data.description).toBeNull();
  });

  it("rejects ROUNDS steps, empty steps, more than 12 steps, and minutes outside 1..60", () => {
    expect(CreateRoutineRequest.safeParse({ name: "A", steps: [{ ...step, durationTypeKey: "ROUNDS" }] }).success).toBe(false);
    expect(CreateRoutineRequest.safeParse({ name: "A", steps: [] }).success).toBe(false);
    expect(CreateRoutineRequest.safeParse({ name: "A", steps: Array(13).fill(step) }).success).toBe(false);
    expect(CreateRoutineRequest.safeParse({ name: "A", steps: [{ ...step, durationValue: 0 }] }).success).toBe(false);
    expect(CreateRoutineRequest.safeParse({ name: "A", steps: [{ ...step, durationValue: 61 }] }).success).toBe(false);
  });

  it("rejects a blank name, a 61-char name and a 281-char description", () => {
    expect(CreateRoutineRequest.safeParse({ name: "   ", steps: [step] }).success).toBe(false);
    expect(CreateRoutineRequest.safeParse({ name: "x".repeat(61), steps: [step] }).success).toBe(false);
    expect(CreateRoutineRequest.safeParse({ name: "A", description: "x".repeat(281), steps: [step] }).success).toBe(false);
  });

  it("strips a client-sent sequenceNumber", () => {
    const parsed = CreateRoutineRequest.safeParse({ name: "A", steps: [{ ...step, sequenceNumber: 9 }] });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.steps[0]).not.toHaveProperty("sequenceNumber");
  });
});
```

Create `app/tests/pages/api/routines/routines.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/routine.service", () => ({
  listRoutines: vi.fn(),
  getRoutine: vi.fn(),
  createRoutine: vi.fn(),
  replaceRoutine: vi.fn(),
  deleteRoutine: vi.fn(),
}));

import * as service from "@services/routine.service";

const locals = { auth: { playerId: "p1" }, requestId: "req-1" };
const body = (value: unknown) =>
  new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify(value),
    headers: { "content-type": "application/json" },
  });
const ROUTINE = { routineId: "rt-1", routineName: "Mine", description: null, isSystemTemplate: false, steps: [] };
const STEPS = [{ exerciseTemplateId: "et-1", durationTypeKey: "MINUTES", durationValue: 30 }];

beforeEach(() => vi.clearAllMocks());

describe("/api/routines", () => {
  it("GET lists", async () => {
    vi.mocked(service.listRoutines).mockResolvedValue({ ok: true, data: { items: [], nextCursor: null } });
    const { GET } = await import("@pages/api/routines/index");
    const response = await GET({ locals } as any);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data: { items: [], nextCursor: null } });
  });

  it("POST creates and returns 201", async () => {
    vi.mocked(service.createRoutine).mockResolvedValue({ ok: true, data: ROUTINE });
    const { POST } = await import("@pages/api/routines/index");
    const response = await POST({ locals, request: body({ name: "Mine", steps: STEPS }) } as any);
    expect(response.status).toBe(201);
    expect(service.createRoutine).toHaveBeenCalledWith("p1", { name: "Mine", description: null, steps: STEPS });
  });

  it("POST returns 422 on a malformed body without calling the service", async () => {
    const { POST } = await import("@pages/api/routines/index");
    const response = await POST({ locals, request: body({ name: "Mine" }) } as any);
    expect(response.status).toBe(422);
    expect(service.createRoutine).not.toHaveBeenCalled();
  });
});

describe("/api/routines/[routineId]", () => {
  it("GET maps NOT_FOUND to 404", async () => {
    vi.mocked(service.getRoutine).mockResolvedValue({ ok: false, code: "NOT_FOUND", details: { routineId: "x" } });
    const { GET } = await import("@pages/api/routines/[routineId]");
    const response = await GET({ locals, params: { routineId: "x" } } as any);
    expect(response.status).toBe(404);
  });

  it("PUT replaces", async () => {
    vi.mocked(service.replaceRoutine).mockResolvedValue({ ok: true, data: ROUTINE });
    const { PUT } = await import("@pages/api/routines/[routineId]");
    const response = await PUT({ locals, params: { routineId: "rt-1" }, request: body({ name: "Mine", steps: STEPS }) } as any);
    expect(response.status).toBe(200);
    expect(service.replaceRoutine).toHaveBeenCalledWith("p1", "rt-1", { name: "Mine", description: null, steps: STEPS });
  });

  it("DELETE returns 204 with an empty body", async () => {
    vi.mocked(service.deleteRoutine).mockResolvedValue({ ok: true, data: null });
    const { DELETE } = await import("@pages/api/routines/[routineId]");
    const response = await DELETE({ locals, params: { routineId: "rt-1" } } as any);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("DELETE maps the read-only system routine to 422", async () => {
    vi.mocked(service.deleteRoutine).mockResolvedValue({
      ok: false, code: "VALIDATION_FAILED", details: { reason: "system routine is read-only" },
    });
    const { DELETE } = await import("@pages/api/routines/[routineId]");
    const response = await DELETE({ locals, params: { routineId: "rt-sys" } } as any);
    expect(response.status).toBe(422);
  });
});
```

Create `app/tests/pages/api/exercise-templates/exercise-templates.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@services/routine.service", () => ({ listExerciseTemplates: vi.fn() }));
import * as service from "@services/routine.service";

describe("GET /api/exercise-templates", () => {
  it("returns the catalog array", async () => {
    vi.mocked(service.listExerciseTemplates).mockResolvedValue({ ok: true, data: [] });
    const { GET } = await import("@pages/api/exercise-templates/index");
    const response = await GET({ locals: { auth: { playerId: "p1" }, requestId: "r" } } as any);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data: [] });
  });
});
```

Create `app/tests/lib/client/api/routines.test.ts` (copy the mocking shape of the existing `app/tests/lib/client/api/training-sessions.test.ts` if present; otherwise):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/client", () => ({ apiRequest: vi.fn() }));
import { apiRequest } from "@client/api/client";
import {
  listRoutines, getRoutine, createRoutine, updateRoutine, deleteRoutine, listExerciseTemplates,
} from "@client/api/routines";
import { SessionApiError } from "@client/api/sessions";

beforeEach(() => vi.clearAllMocks());

describe("client routines api", () => {
  it("listRoutines GETs /api/routines and unwraps data", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ok: true, data: { items: [], nextCursor: null }, requestId: "r" });
    expect(await listRoutines()).toEqual({ items: [], nextCursor: null });
    expect(apiRequest).toHaveBeenCalledWith("/api/routines", { method: "GET" });
  });

  it("getRoutine encodes the id", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ok: true, data: {}, requestId: "r" });
    await getRoutine("a b");
    expect(apiRequest).toHaveBeenCalledWith("/api/routines/a%20b", { method: "GET" });
  });

  it("createRoutine POSTs the validated body", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ok: true, data: {}, requestId: "r" });
    await createRoutine({ name: "A", description: null, steps: [{ exerciseTemplateId: "e", durationTypeKey: "MINUTES", durationValue: 30 }] });
    expect(apiRequest).toHaveBeenCalledWith("/api/routines", expect.objectContaining({ method: "POST" }));
  });

  it("updateRoutine PUTs; deleteRoutine DELETEs and resolves void", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ok: true, data: null, requestId: "r" });
    await updateRoutine("rt", { name: "A", description: null, steps: [{ exerciseTemplateId: "e", durationTypeKey: "MINUTES", durationValue: 30 }] });
    expect(apiRequest).toHaveBeenCalledWith("/api/routines/rt", expect.objectContaining({ method: "PUT" }));
    await expect(deleteRoutine("rt")).resolves.toBeUndefined();
    expect(apiRequest).toHaveBeenCalledWith("/api/routines/rt", { method: "DELETE" });
  });

  it("listExerciseTemplates GETs the catalog", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ok: true, data: [], requestId: "r" });
    expect(await listExerciseTemplates()).toEqual([]);
    expect(apiRequest).toHaveBeenCalledWith("/api/exercise-templates", { method: "GET" });
  });

  it("throws SessionApiError carrying code and details on a failure envelope", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false, requestId: "r",
      error: { code: "VALIDATION_FAILED", message: "bad", retryable: false, details: { issues: ["x"] } },
    });
    await expect(listRoutines()).rejects.toMatchObject({ name: "SessionApiError", code: "VALIDATION_FAILED", details: { issues: ["x"] } });
    await expect(listRoutines()).rejects.toBeInstanceOf(SessionApiError);
  });
});
```

- [ ] **Step 2: Run to see them fail**

```bash
cd app && npm test -- tests/pages/api/routines tests/pages/api/exercise-templates tests/lib/client/api/routines.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Contracts**

Create `app/src/pages/api/routines/types.ts`:

```ts
import { z } from "zod";

/** Phase 1 accepts MINUTES only (06-API/04-Endpoint-Contracts.md, D320). */
export const RoutineStepInput = z.object({
  exerciseTemplateId: z.string().min(1),
  durationTypeKey: z.literal("MINUTES"),
  durationValue: z.number().int().min(1).max(60),
});

export const CreateRoutineRequest = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(280).nullable().default(null),
  steps: z.array(RoutineStepInput).min(1).max(12),
});
export type CreateRoutineRequestInput = z.infer<typeof CreateRoutineRequest>;

export const UpdateRoutineRequest = CreateRoutineRequest;
export type UpdateRoutineRequestInput = z.infer<typeof UpdateRoutineRequest>;

export const RoutineStep = z.object({
  sequenceNumber: z.number().int(),
  exerciseTemplateId: z.string(),
  exerciseName: z.string(),
  exerciseDescription: z.string().nullable(),
  exerciseTypeKey: z.string(),
  gameTypeKey: z.string().nullable(),
  durationValue: z.number().int(),
  durationTypeKey: z.string(),
});

export const RoutineExecutionResponse = z.object({
  routineId: z.string(),
  routineName: z.string(),
  description: z.string().nullable(),
  isSystemTemplate: z.boolean(),
  steps: z.array(RoutineStep),
});
export type RoutineExecutionData = z.infer<typeof RoutineExecutionResponse>;

export const RoutineSummary = z.object({
  routineId: z.string(),
  routineName: z.string(),
  description: z.string().nullable(),
  isSystemTemplate: z.boolean(),
  stepCount: z.number().int(),
  totalMinutes: z.number().int(),
});
export type RoutineSummaryData = z.infer<typeof RoutineSummary>;

export const RoutineListResponse = z.object({
  items: z.array(RoutineSummary),
  nextCursor: z.null(),
});
export type RoutineListData = z.infer<typeof RoutineListResponse>;
```

Create `app/src/pages/api/exercise-templates/types.ts`:

```ts
import { z } from "zod";

export const ExerciseTemplateCatalogEntry = z.object({
  exerciseTemplateId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  exerciseTypeKey: z.string(),
  gameTypeKey: z.string().nullable(),
});
export type ExerciseTemplateCatalogEntryData = z.infer<
  typeof ExerciseTemplateCatalogEntry
>;
```

In `app/src/pages/api/types.ts` add, beside the existing raises:

```ts
export * from "./routines/types";
export * from "./exercise-templates/types";
```

- [ ] **Step 4: Controllers**

Create `app/src/pages/api/routines/index.ts`:

```ts
import type { APIRoute } from "astro";
import { CreateRoutineRequest } from "./types";
import { createRoutine, listRoutines } from "@services/routine.service";
import { ok, fail } from "@server/envelope";
import { parseAndValidateBody } from "@server/parse-json-body";

export const GET: APIRoute = async ({ locals }) => {
  const auth = locals.auth!;
  const result = await listRoutines(auth.playerId!);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

export const POST: APIRoute = async ({ locals, request }) => {
  const auth = locals.auth!;
  const parsed = await parseAndValidateBody(
    CreateRoutineRequest,
    request,
    locals.requestId,
  );
  if (!parsed.ok) return parsed.response;

  const result = await createRoutine(auth.playerId!, parsed.data);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId, 201);
};
```

Create `app/src/pages/api/routines/[routineId].ts`:

```ts
import type { APIRoute } from "astro";
import { UpdateRoutineRequest } from "./types";
import {
  deleteRoutine,
  getRoutine,
  replaceRoutine,
} from "@services/routine.service";
import { ok, fail } from "@server/envelope";
import { parseAndValidateBody } from "@server/parse-json-body";

export const GET: APIRoute = async ({ locals, params }) => {
  const auth = locals.auth!;
  const result = await getRoutine(auth.playerId!, params.routineId!);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

export const PUT: APIRoute = async ({ locals, params, request }) => {
  const auth = locals.auth!;
  const parsed = await parseAndValidateBody(
    UpdateRoutineRequest,
    request,
    locals.requestId,
  );
  if (!parsed.ok) return parsed.response;

  const result = await replaceRoutine(
    auth.playerId!,
    params.routineId!,
    parsed.data,
  );
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};

/** `204` carries no envelope: there is no body to put a `requestId` in; the header still carries it. */
export const DELETE: APIRoute = async ({ locals, params }) => {
  const auth = locals.auth!;
  const result = await deleteRoutine(auth.playerId!, params.routineId!);
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return new Response(null, {
    status: 204,
    headers: { "X-Request-Id": locals.requestId },
  });
};
```

Create `app/src/pages/api/exercise-templates/index.ts`:

```ts
import type { APIRoute } from "astro";
import { listExerciseTemplates } from "@services/routine.service";
import { ok, fail } from "@server/envelope";

export const GET: APIRoute = async ({ locals }) => {
  const result = await listExerciseTemplates();
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};
```

Check `app/src/middleware.ts` treats `/api/exercise-templates` and `/api/routines` as authenticated API routes (they match the `api-*` route class by prefix; confirm, do not special-case).

- [ ] **Step 5: Client module and barrel**

Append to the `export { … } from "@routes/types"` block in `app/src/lib/client/api/types.ts`:

```ts
  CreateRoutineRequest,
  type CreateRoutineRequestInput,
  UpdateRoutineRequest,
  type UpdateRoutineRequestInput,
  type RoutineExecutionData,
  type RoutineSummaryData,
  type RoutineListData,
  type ExerciseTemplateCatalogEntryData,
```

Create `app/src/lib/client/api/routines.ts`:

```ts
import { apiRequest } from "./client";
import { SessionApiError } from "./sessions";
import {
  CreateRoutineRequest,
  UpdateRoutineRequest,
  type CreateRoutineRequestInput,
  type UpdateRoutineRequestInput,
  type RoutineExecutionData,
  type RoutineListData,
  type ExerciseTemplateCatalogEntryData,
} from "./types";
import type { ApiResult } from "./types";

function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) {
    throw new SessionApiError(
      result.error.code,
      result.error.message,
      result.requestId,
      result.error.details,
    );
  }
  return result.data;
}

export async function listRoutines(): Promise<RoutineListData> {
  return unwrap(await apiRequest<RoutineListData>("/api/routines", { method: "GET" }));
}

export async function getRoutine(routineId: string): Promise<RoutineExecutionData> {
  return unwrap(
    await apiRequest<RoutineExecutionData>(
      `/api/routines/${encodeURIComponent(routineId)}`,
      { method: "GET" },
    ),
  );
}

export async function createRoutine(
  body: CreateRoutineRequestInput,
): Promise<RoutineExecutionData> {
  const payload = CreateRoutineRequest.parse(body);
  return unwrap(
    await apiRequest<RoutineExecutionData>("/api/routines", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

export async function updateRoutine(
  routineId: string,
  body: UpdateRoutineRequestInput,
): Promise<RoutineExecutionData> {
  const payload = UpdateRoutineRequest.parse(body);
  return unwrap(
    await apiRequest<RoutineExecutionData>(
      `/api/routines/${encodeURIComponent(routineId)}`,
      { method: "PUT", body: JSON.stringify(payload) },
    ),
  );
}

export async function deleteRoutine(routineId: string): Promise<void> {
  unwrap(
    await apiRequest<null>(`/api/routines/${encodeURIComponent(routineId)}`, {
      method: "DELETE",
    }),
  );
}

export async function listExerciseTemplates(): Promise<
  ExerciseTemplateCatalogEntryData[]
> {
  return unwrap(
    await apiRequest<ExerciseTemplateCatalogEntryData[]>(
      "/api/exercise-templates",
      { method: "GET" },
    ),
  );
}
```

`apiRequest` turns a `204` with no body into `SERVICE_UNAVAILABLE` (it `await response.json()`s). Check `client.ts`: if it does not already treat `204` as `{ ok: true, data: null }`, add that branch in `attempt()` before the JSON parse — with a test in `app/tests/lib/client/api/client.test.ts`:

```ts
it("treats a 204 as a success envelope with null data", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
  const result = await apiRequest("/api/routines/x", { method: "DELETE" });
  expect(result).toMatchObject({ ok: true, data: null });
});
```

- [ ] **Step 6: Run to green**

```bash
cd app && npm test -- tests/pages/api/routines tests/pages/api/exercise-templates tests/lib/client/api
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/pages/api/routines app/src/pages/api/exercise-templates app/src/pages/api/types.ts app/src/lib/client/api/routines.ts app/src/lib/client/api/types.ts app/src/lib/client/api/client.ts app/tests/pages/api/routines app/tests/pages/api/exercise-templates app/tests/lib/client/api
git commit -m "feat(api): /api/routines CRUD and /api/exercise-templates (D306); client module"
```

---

### Task 6: Start a training by routine id; validate and time the GAME step

**Files:**
- Modify: `app/src/pages/api/training-sessions/types.ts`, `index.ts`
- Modify: `app/src/repositories/training-session.repository.ts`
- Modify: `app/src/services/training-session.service.ts`, `app/src/services/types.ts` (`StartTrainingResult.routineTemplateId`)
- Modify: `app/src/lib/client/api/training-sessions.ts` (no code change; the Zod import already flows) — verify only
- Test: `app/tests/pages/api/training-sessions/training-sessions.test.ts`, `types.test.ts`, `app/tests/repositories/training-session.repository.test.ts`, `app/tests/services/training-session.service.test.ts`

**Interfaces:**
- Produces: `StartTrainingRequest = { routineTemplateId: string }`; `findRoutineTemplateSteps(db, routineTemplateId, playerId) → { routineTemplateId, routineName, steps } | undefined`; `startTraining(playerId, routineTemplateId)`; response and snapshot both carry `routineTemplateId`.

- [ ] **Step 1: Re-point the existing tests to the id-keyed guarantee (same behaviours, new key)**

In `app/tests/pages/api/training-sessions/training-sessions.test.ts`: request body `{ routineTemplateId: "rt-1" }`, expectation `toHaveBeenCalledWith("p1", "rt-1")`, and response data gains `routineTemplateId: "rt-1"`. In `types.test.ts` (if it asserts `routineTemplateName`), assert `StartTrainingRequest.safeParse({ routineTemplateId: "x" }).success === true` and `{ routineTemplateName: "x" }` fails.

In `app/tests/repositories/training-session.repository.test.ts` replace the `findRoutineTemplateSteps` describe with a rendering test:

```ts
describe("findRoutineTemplateSteps", () => {
  it("filters by routine id and (system OR own) and returns the routine name", async () => {
    const { db, statements } = renderingDb([]);
    await findRoutineTemplateSteps(db, "rt-1", "p1");
    const sql = onlyStatement(statements);
    expect(sql).toContain('"routine_id" = $1');
    expect(sql).toMatch(/"is_system_template" = \$2 or .*"player_id" = \$3/);
    expect(statements[0].params).toEqual(["rt-1", true, "p1"]);
  });

  it("returns undefined when the routine has no visible rows", async () => {
    const { db } = renderingDb([]);
    expect(await findRoutineTemplateSteps(db, "rt-1", "p1")).toBeUndefined();
  });

  it("shapes rows into { routineTemplateId, routineName, steps }", async () => {
    const { db } = renderingDb([
      { routine_id: "rt-1", routine_name: "Mine", sequence_number: 1, exercise_type_key: "WARM_UP",
        exercise_ruleset_version_key: "WARM_UP_V1", game_type_key: null, duration_type_key: "MINUTES",
        duration_value: 10, default_configuration: {}, step_configuration: null },
    ]);
    const result = await findRoutineTemplateSteps(db, "rt-1", "p1");
    expect(result).toMatchObject({ routineTemplateId: "rt-1", routineName: "Mine" });
    expect(result?.steps[0]).toMatchObject({ sequenceNumber: 1, exerciseTypeKey: "WARM_UP" });
  });
});
```

(If `renderingDb` row keys must be camelCase for the pg-proxy driver in this setup, mirror whatever `render-sql.ts`'s existing consumers pass.)

In `app/tests/services/training-session.service.test.ts`:

- `RESOLVED` gains `routineName: "Balanced Training"`; the GAME row's `defaultConfiguration` becomes the six TUOD keys (seed `0020`) and `stepConfiguration: null`; add `exerciseName`-free fields as today.
- Every `startTraining("p1", "Balanced Training")` becomes `startTraining("p1", "rt-1")`; the unknown case expects `details: { reason: "unknown routineTemplateId" }` and `findRoutineTemplateSteps` `toHaveBeenCalledWith(expect.anything(), "rt-1", "p1")`.
- The resolve test's GAME expectation becomes:

```ts
    expect(result.data.steps[1]).toMatchObject({
      exerciseTypeKey: "GAME",
      gameTypeKey: "TUOD",
      configuration: { starting_target: 41, duration_type: "MINUTES", duration_value: 10 },
    });
    expect(result.data.routineTemplateId).toBe("rt-1");
    expect(trainingRepo.insertTrainingActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        configuration: expect.objectContaining({ routineTemplateId: "rt-1", routineName: "Balanced Training" }),
      }),
    );
```

Add two new cases:

```ts
  it("injects the step's minutes into a GAME step's duration keys", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue({
      ...RESOLVED,
      steps: [{ ...RESOLVED.steps[1], durationValue: 15 }],
    } as any);
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    const result = await startTraining("p1", "rt-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.steps[0].configuration).toMatchObject({ duration_type: "MINUTES", duration_value: 15 });
  });

  it("refuses a GAME step whose merged configuration fails its ruleset (issue #392)", async () => {
    vi.mocked(trainingRepo.findRoutineTemplateSteps).mockResolvedValue({
      ...RESOLVED,
      steps: [{ ...RESOLVED.steps[1], defaultConfiguration: { starting_target: 41 } }],
    } as any);
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    const result = await startTraining("p1", "rt-1");
    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "invalid step configuration", steps: [{ sequenceNumber: 4 }] },
    });
  });
```

- [ ] **Step 2: Run to see them fail**

```bash
cd app && npm test -- tests/pages/api/training-sessions tests/repositories/training-session.repository.test.ts tests/services/training-session.service.test.ts
```

Expected: FAIL on the new key, the missing `routineName`, the GAME validation and injection.

- [ ] **Step 3: Contract**

`app/src/pages/api/training-sessions/types.ts`:

```ts
export const StartTrainingRequest = z.object({
  routineTemplateId: z.string().min(1),
});
…
export const StartTrainingResponse = z.object({
  activityId: z.string(),
  routineTemplateId: z.string(),
  routineName: z.string(),
  steps: z.array(TrainingStepResolved),
});
```

`index.ts`: `startTraining(auth.playerId!, parsed.data.routineTemplateId)`.

- [ ] **Step 4: Repository**

Replace `findRoutineTemplateSteps` in `training-session.repository.ts` (import `or` from drizzle):

```ts
/**
 * A routine's ordered steps through `v_routine_execution`, visible when the
 * routine is a system routine or the caller's own (D320). A stepless routine
 * reads as no routine; `startTraining` answers `VALIDATION_FAILED`.
 */
export async function findRoutineTemplateSteps(
  db: Db,
  routineTemplateId: string,
  playerId: string,
): Promise<
  | {
      routineTemplateId: string;
      routineName: string;
      steps: RoutineStepTemplateRow[];
    }
  | undefined
> {
  const rows = await db
    .select({
      routineTemplateId: vRoutineExecution.routineId,
      routineName: vRoutineExecution.routineName,
      sequenceNumber: vRoutineExecution.sequenceNumber,
      exerciseTypeKey: vRoutineExecution.exerciseTypeKey,
      exerciseRulesetVersionKey: vRoutineExecution.exerciseRulesetVersionKey,
      gameTypeKey: vRoutineExecution.gameTypeKey,
      durationTypeKey: vRoutineExecution.durationTypeKey,
      durationValue: vRoutineExecution.durationValue,
      defaultConfiguration: vRoutineExecution.defaultConfiguration,
      stepConfiguration: vRoutineExecution.stepConfiguration,
    })
    .from(vRoutineExecution)
    .where(
      and(
        eq(vRoutineExecution.routineId, routineTemplateId),
        or(
          eq(vRoutineExecution.isSystemTemplate, true),
          eq(vRoutineExecution.playerId, playerId),
        ),
      ),
    )
    .orderBy(vRoutineExecution.sequenceNumber);

  const first = rows[0];
  if (!first) return undefined;

  return {
    routineTemplateId: first.routineTemplateId as string,
    routineName: first.routineName as string,
    steps: rows.map(
      ({ routineTemplateId: _id, routineName: _name, ...step }) => step,
    ) as RoutineStepTemplateRow[],
  };
}
```

- [ ] **Step 5: Service**

In `services/types.ts`, `StartTrainingResult` gains `routineTemplateId: string`.

In `training-session.service.ts`:

```ts
import { getRulesetValidator } from "./rulesets/registry";
…
const ROUTINE_CAPTURE_MODE_KEY = "ANALYTICS";
const ROUTINE_INPUT_MODE_KEY = "VISUAL_BOARD";

/**
 * TUOD reads its timed length from `duration_type`/`duration_value`; a
 * routine step's own minutes win over the template default (D320 §3.5).
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

function stepConfigurationIssues(
  row: RoutineStepTemplateRow,
  configuration: Record<string, unknown>,
): string[] | undefined {
  if (row.exerciseTypeKey === GAME_EXERCISE_TYPE_KEY) {
    const validator = getRulesetValidator(FINISHING_RULESET_VERSION_KEY);
    if (!validator) return [`no ruleset validator for ${FINISHING_RULESET_VERSION_KEY}`];
    const result = validator.validateConfig({
      config: configuration,
      captureModeKey: ROUTINE_CAPTURE_MODE_KEY,
      inputModeKey: ROUTINE_INPUT_MODE_KEY,
    });
    return result.ok ? undefined : result.issues;
  }
  …existing non-game body unchanged…
}
```

Update the doc comment above `stepConfigurationIssues`: a GAME step is now validated against the finishing ruleset under the routine capture pair (issue #392); Phase 2 generalises the key.

`startTraining`:

```ts
export async function startTraining(
  playerId: string,
  routineTemplateId: string,
): Promise<ServiceResult<StartTrainingResult>> {
  const db = getDb();
  const resolved = await findRoutineTemplateSteps(db, routineTemplateId, playerId);
  if (!resolved) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown routineTemplateId" },
    };
  }
  …status ids unchanged…
  for (const row of resolved.steps) {
    const configuration = mergedConfiguration(row);
    injectGameStepDuration(row, configuration);
    const issues = stepConfigurationIssues(row, configuration);
    …
  }
  …
    await insertTrainingActivity(tx, {
      …,
      configuration: {
        routineTemplateId: resolved.routineTemplateId,
        routineName: resolved.routineName,
        steps,
      },
    });
  …
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
```

Replace the `startGameStep` constants' use of `FINISHING_*` only where the two constants already exist; nothing else in that function changes in Phase 1.

- [ ] **Step 6: Run to green; run the whole suite**

```bash
cd app && npm test
```

Expected: PASS. `balanced-training-play.data.test.ts` still passes (it mocks `startTraining`); Task 7 re-points it.

- [ ] **Step 7: Commit**

```bash
git add app/src/pages/api/training-sessions app/src/repositories/training-session.repository.ts app/src/services/training-session.service.ts app/src/services/types.ts app/tests/pages/api/training-sessions app/tests/repositories/training-session.repository.test.ts app/tests/services/training-session.service.test.ts
git commit -m "feat(training): start a training by routineTemplateId; validate and time the GAME step (D320, #392)"
```

---

### Task 7: Data-driven `/training`, detail and play routes

**Files:**
- Create: `app/src/lib/training/routines/routine-route.ts`
- Create: `app/src/lib/training/routines/training-index.data.ts`
- Create: `app/src/lib/training/routines/routine-detail.data.ts`
- Rename: `app/src/lib/training/routines/balanced-training-play.data.ts` → `routine-play.data.ts` (`balancedTrainingPlay` → `routinePlay`)
- Modify: `app/src/lib/training/routines/types.ts` (`BalancedTrainingPlayContext` → `RoutinePlayContext`; new context types), `app/src/lib/training/routines/finishing-step.data.ts` (comment only: file name reference)
- Modify: `app/src/lib/client/alpine/register-route-data.ts`
- Modify: `app/src/pages/training/index.astro`
- Create: `app/src/pages/training/routines/detail/index.astro`, `app/src/pages/training/routines/play/index.astro`
- Delete: `app/src/pages/training/balanced-training/index.astro`, `app/src/pages/training/balanced-training/play/index.astro`
- Modify: `app/src/components/layout/training/routines/RoutineDetail.astro`
- Tests: `app/tests/lib/training/routines/routine-route.test.ts`, `training-index.data.test.ts`, `routine-detail.data.test.ts`; rename `balanced-training-play.data.test.ts` → `routine-play.data.test.ts`

**Interfaces:**
- Produces: `routineIdFromLocation(): string | null`; Alpine factories `trainingIndex()`, `routineDetail()`, `routinePlay()`; routes `/training/routines/detail?routine=<id>`, `/training/routines/play?routine=<id>`.

- [ ] **Step 1: Failing tests**

`app/tests/lib/training/routines/routine-route.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { routineIdFromLocation, routineDetailPath, routinePlayPath, routineEditPath } from "@lib/training/routines/routine-route";

describe("routine routes", () => {
  it("reads ?routine= from the location, null when absent or blank", () => {
    history.replaceState(null, "", "/training/routines/detail?routine=rt-1");
    expect(routineIdFromLocation()).toBe("rt-1");
    history.replaceState(null, "", "/training/routines/detail?routine=");
    expect(routineIdFromLocation()).toBeNull();
    history.replaceState(null, "", "/training/routines/detail");
    expect(routineIdFromLocation()).toBeNull();
  });

  it("builds encoded paths", () => {
    expect(routineDetailPath("a b")).toBe("/training/routines/detail?routine=a%20b");
    expect(routinePlayPath("rt")).toBe("/training/routines/play?routine=rt");
    expect(routineEditPath("rt")).toBe("/training/routines/edit?routine=rt");
  });
});
```

`app/tests/lib/training/routines/training-index.data.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@client/api/routines", () => ({ listRoutines: vi.fn() }));
import { listRoutines } from "@client/api/routines";
import { trainingIndex } from "@lib/training/routines/training-index.data";

const SYS = { routineId: "s", routineName: "Balanced Training", description: "d", isSystemTemplate: true, stepCount: 4, totalMinutes: 30 };
const OWN = { routineId: "o", routineName: "Mine", description: null, isSystemTemplate: false, stepCount: 2, totalMinutes: 45 };

beforeEach(() => vi.clearAllMocks());

describe("trainingIndex", () => {
  it("loads routines and exposes them with a duration label and detail href", async () => {
    vi.mocked(listRoutines).mockResolvedValue({ items: [SYS, OWN], nextCursor: null });
    const data = trainingIndex();
    await data.init();
    expect(data.loading).toBe(false);
    expect(data.routines).toEqual([SYS, OWN]);
    expect(data.durationLabel(OWN)).toBe("45 min");
    expect(data.detailHref(OWN)).toBe("/training/routines/detail?routine=o");
  });

  it("surfaces a load failure as error text", async () => {
    vi.mocked(listRoutines).mockRejectedValue(new Error("boom"));
    const data = trainingIndex();
    await data.init();
    expect(data.error).toContain("Could not load");
  });
});
```

`app/tests/lib/training/routines/routine-detail.data.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@client/api/routines", () => ({ getRoutine: vi.fn(), deleteRoutine: vi.fn() }));
import { getRoutine, deleteRoutine } from "@client/api/routines";
import { routineDetail } from "@lib/training/routines/routine-detail.data";

const ROUTINE = {
  routineId: "o", routineName: "Mine", description: null, isSystemTemplate: false,
  steps: [{ sequenceNumber: 1, exerciseTemplateId: "e", exerciseName: "Switching", exerciseDescription: "x", exerciseTypeKey: "SWITCHING", gameTypeKey: null, durationValue: 30, durationTypeKey: "MINUTES" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  history.replaceState(null, "", "/training/routines/detail?routine=o");
});

describe("routineDetail", () => {
  it("loads the routine named in the URL and derives labels", async () => {
    vi.mocked(getRoutine).mockResolvedValue(ROUTINE);
    const data = routineDetail();
    await data.init();
    expect(getRoutine).toHaveBeenCalledWith("o");
    expect(data.routine).toEqual(ROUTINE);
    expect(data.durationLabel()).toBe("30 min");
    expect(data.stepDuration(ROUTINE.steps[0])).toBe("30 min");
    expect(data.playPath()).toBe("/training/routines/play?routine=o");
    expect(data.editPath()).toBe("/training/routines/edit?routine=o");
    expect(data.canEdit()).toBe(true);
  });

  it("hides edit/delete for a system routine", async () => {
    vi.mocked(getRoutine).mockResolvedValue({ ...ROUTINE, isSystemTemplate: true });
    const data = routineDetail();
    await data.init();
    expect(data.canEdit()).toBe(false);
  });

  it("errors without a routine id", async () => {
    history.replaceState(null, "", "/training/routines/detail");
    const data = routineDetail();
    await data.init();
    expect(data.error).toContain("No routine");
    expect(getRoutine).not.toHaveBeenCalled();
  });

  it("confirmDelete deletes and navigates to /training", async () => {
    vi.mocked(getRoutine).mockResolvedValue(ROUTINE);
    vi.mocked(deleteRoutine).mockResolvedValue(undefined);
    const data = routineDetail();
    await data.init();
    const assign = vi.fn();
    data.navigate = assign;
    data.requestDelete();
    expect(data.deleting).toBe(true);
    await data.confirmDelete();
    expect(deleteRoutine).toHaveBeenCalledWith("o");
    expect(assign).toHaveBeenCalledWith("/training");
  });
});
```

Rename the play test: `git mv app/tests/lib/training/routines/balanced-training-play.data.test.ts app/tests/lib/training/routines/routine-play.data.test.ts`; inside, import `routinePlay` from `@lib/training/routines/routine-play.data`, type `RoutinePlayContext`, and in the `init` test set `history.replaceState(null, "", "/training/routines/play?routine=rt-1")` and expect `startTraining` `toHaveBeenCalledWith({ routineTemplateId: "rt-1" })`. Add one case:

```ts
  it("reports an error and does not start when the URL names no routine", async () => {
    history.replaceState(null, "", "/training/routines/play");
    const store = makeStore();
    await store.init();
    expect(trainingApi.startTraining).not.toHaveBeenCalled();
    expect(store.error).toContain("No routine");
  });
```

Every other assertion in that file stays byte-identical (same guarantee, new module name — root invariant).

- [ ] **Step 2: Run to see them fail**

```bash
cd app && npm test -- tests/lib/training/routines
```

- [ ] **Step 3: `routine-route.ts`**

```ts
const ROUTINE_PARAM = "routine";

/** The routine id the current page was opened for (`?routine=<id>`), or null. */
export function routineIdFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URL(window.location.href).searchParams.get(ROUTINE_PARAM);
  return value && value.trim().length > 0 ? value : null;
}

export function routineDetailPath(routineId: string): string {
  return `/training/routines/detail?${ROUTINE_PARAM}=${encodeURIComponent(routineId)}`;
}

export function routinePlayPath(routineId: string): string {
  return `/training/routines/play?${ROUTINE_PARAM}=${encodeURIComponent(routineId)}`;
}

export function routineEditPath(routineId: string): string {
  return `/training/routines/edit?${ROUTINE_PARAM}=${encodeURIComponent(routineId)}`;
}
```

- [ ] **Step 4: `training-index.data.ts`**

```ts
import { listRoutines } from "@client/api/routines";
import { routineDetailPath } from "./routine-route";
import type { RoutineSummaryData } from "@client/api/types";
import type { TrainingIndexContext } from "./types";

export function trainingIndex() {
  return {
    loading: true,
    error: "",
    routines: [] as RoutineSummaryData[],

    async init(this: TrainingIndexContext) {
      this.loading = true;
      this.error = "";
      try {
        this.routines = (await listRoutines()).items;
      } catch {
        this.error = "Could not load your routines. Check your connection and reload.";
      } finally {
        this.loading = false;
      }
    },

    durationLabel(routine: RoutineSummaryData): string {
      return `${routine.totalMinutes} min`;
    },

    detailHref(routine: RoutineSummaryData): string {
      return routineDetailPath(routine.routineId);
    },
  };
}
```

Add to `lib/training/routines/types.ts`:

```ts
export type TrainingIndexContext = ReturnType<typeof trainingIndex>;
export type RoutineDetailContext = ReturnType<typeof routineDetail>;
```

(import both factories with `import type`).

- [ ] **Step 5: `routine-detail.data.ts`**

```ts
import { deleteRoutine, getRoutine } from "@client/api/routines";
import {
  routineEditPath,
  routineIdFromLocation,
  routinePlayPath,
} from "./routine-route";
import type { RoutineExecutionData } from "@client/api/types";
import type { RoutineDetailContext } from "./types";

type Step = RoutineExecutionData["steps"][number];

export function routineDetail() {
  return {
    loading: true,
    error: "",
    routine: null as RoutineExecutionData | null,
    deleting: false,
    deleteBusy: false,
    starting: false,

    navigate(path: string) {
      globalThis.location.href = path;
    },

    async init(this: RoutineDetailContext) {
      const routineId = routineIdFromLocation();
      if (!routineId) {
        this.error = "No routine selected.";
        this.loading = false;
        return;
      }
      try {
        this.routine = await getRoutine(routineId);
      } catch {
        this.error = "Could not load this routine.";
      } finally {
        this.loading = false;
      }
    },

    durationLabel(this: RoutineDetailContext): string {
      const total = (this.routine?.steps ?? []).reduce(
        (sum, step) => (step.durationTypeKey === "MINUTES" ? sum + step.durationValue : sum),
        0,
      );
      return `${total} min`;
    },

    stepDuration(step: Step): string {
      return step.durationTypeKey === "MINUTES"
        ? `${step.durationValue} min`
        : `${step.durationValue} rounds`;
    },

    canEdit(this: RoutineDetailContext): boolean {
      return this.routine !== null && !this.routine.isSystemTemplate;
    },

    playPath(this: RoutineDetailContext): string {
      return this.routine ? routinePlayPath(this.routine.routineId) : "/training";
    },

    editPath(this: RoutineDetailContext): string {
      return this.routine ? routineEditPath(this.routine.routineId) : "/training";
    },

    start(this: RoutineDetailContext) {
      this.starting = true;
      this.navigate(this.playPath());
    },

    requestDelete(this: RoutineDetailContext) {
      this.deleting = true;
    },

    cancelDelete(this: RoutineDetailContext) {
      this.deleting = false;
    },

    async confirmDelete(this: RoutineDetailContext) {
      if (!this.routine || this.deleteBusy) return;
      this.deleteBusy = true;
      try {
        await deleteRoutine(this.routine.routineId);
        this.navigate("/training");
      } catch {
        this.error = "Could not delete this routine.";
        this.deleteBusy = false;
        this.deleting = false;
      }
    },
  };
}
```

`routine-start.data.ts` (`routineStart(playPath)`) loses its only consumer here; delete it and its test in the same commit (subject removed → test removed, root invariant), and drop its `Alpine.data` registration.

- [ ] **Step 6: `routine-play.data.ts`**

```bash
git mv app/src/lib/training/routines/balanced-training-play.data.ts app/src/lib/training/routines/routine-play.data.ts
```

Then: rename `balancedTrainingPlay` → `routinePlay`, `BalancedTrainingPlayContext` → `RoutinePlayContext` (types.ts, this file, `finishing-step.data.ts` comment, tests); delete `const ROUTINE_NAME`; in `init()`:

```ts
      const routineTemplateId = routineIdFromLocation();
      if (!routineTemplateId) {
        this.error = "No routine selected.";
        this.loading = false;
        return;
      }
      try {
        const result = await startTraining({ routineTemplateId });
```

Import `routineIdFromLocation` from `./routine-route`. Nothing else in the file changes.

`register-route-data.ts`: replace the `balancedTrainingPlay`/`routineStart` imports and registrations with

```ts
import { routinePlay } from "@lib/training/routines/routine-play.data";
import { routineDetail } from "@lib/training/routines/routine-detail.data";
import { trainingIndex } from "@lib/training/routines/training-index.data";
…
  Alpine.data("routinePlay", routinePlay);
  Alpine.data("routineDetail", routineDetail);
  Alpine.data("trainingIndex", trainingIndex);
```

- [ ] **Step 7: Pages and the detail component**

`app/src/pages/training/index.astro`:

```astro
---
export const prerender = true;

import AppLayout from "@layouts/AppLayout.astro";
import GameCard from "@components/layout/games/GameCard.astro";
import RoutineCard from "@components/layout/training/routines/RoutineCard.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
---

<AppLayout title="Training">
  <div
    class="p-4 space-y-4"
    x-data="trainingIndex()"
  >
    <h1 class="text-xl font-semibold text-foreground">Training</h1>
    <ErrorAlert />
    <template x-for="routine in routines" :key="routine.routineId">
      <RoutineCard />
    </template>
    <GameCard
      href="/training/routines/new"
      title="New routine"
      caption="Compose your own 30–60 minute session from the exercise catalog"
    />
    <GameCard
      href="/training/quick-subtract"
      title="Quick Subtract"
      caption="Drill checkout mental math against the clock or a target count"
    />
  </div>
</AppLayout>
```

Create `app/src/components/layout/training/routines/RoutineCard.astro` — the Alpine-bound twin of `GameCard` for an `x-for` row (reads `routine` from the enclosing scope):

```astro
---
/**
 * One routine in the `/training` list. Alpine-bound so it can render inside
 * `x-for`; expects a `routine` (`RoutineSummaryData`) in scope and the
 * `trainingIndex()` helpers on the parent.
 */
import CardWrapper from "@components/ui/CardWrapper.astro";
import Badge from "@components/ui/Badge.astro";
---

<a
  :href="detailHref(routine)"
  class="block"
>
  <CardWrapper class="flex-row justify-between items-center gap-4 glass">
    <div class="flex flex-col gap-0.5">
      <div class="flex items-center gap-2">
        <h3
          class="font-semibold text-base text-accent"
          x-text="routine.routineName"
        >
        </h3>
        <Badge
          class="text-xs"
          x-text="durationLabel(routine)"
        />
        <Badge
          variant="neutral"
          class="text-xs"
          x-show="!routine.isSystemTemplate"
          x-cloak
        >
          mine
        </Badge>
      </div>
      <p
        class="text-xs text-muted-foreground"
        x-text="routine.description ?? ''"
      >
      </p>
    </div>
  </CardWrapper>
</a>
```

`RoutineDetail.astro` becomes Alpine-bound (no props; mounts nothing itself — the page mounts `routineDetail()`):

```astro
---
/**
 * Routine detail: title + duration pill, ordered steps, Start; Edit/Delete for
 * the player's own routines. Reads `routineDetail()` state from the parent
 * scope (`routine-detail.data.ts`).
 */
import Badge from "@components/ui/Badge.astro";
import Button from "@components/forms/Button.astro";
import ConfirmDialog from "@components/ui/ConfirmDialog.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
---

<div class="space-y-4">
  <ErrorAlert />
  <template x-if="routine">
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1
          class="text-xl font-semibold text-foreground"
          x-text="routine.routineName"
        >
        </h1>
        <Badge x-text="durationLabel()" />
      </div>
      <p
        class="text-sm text-muted-foreground"
        x-show="routine.description"
        x-cloak
        x-text="routine.description"
      >
      </p>
      <ol class="space-y-4">
        <template x-for="(step, index) in routine.steps" :key="step.sequenceNumber">
          <li class="space-y-1">
            <div class="flex items-baseline gap-2">
              <span
                class="text-sm font-semibold text-accent"
                x-text="`${index + 1}. ${step.exerciseName}`"
              >
              </span>
              <span
                class="text-xs text-muted-foreground"
                x-text="`— ${stepDuration(step)}`"
              >
              </span>
            </div>
            <p
              class="text-sm text-muted-foreground"
              x-text="step.exerciseDescription ?? ''"
            >
            </p>
          </li>
        </template>
      </ol>
      <Button
        title="Start"
        variant="primary"
        grow
        @click="start()"
        loadingExpr="starting"
      />
      <div
        class="flex gap-2"
        x-show="canEdit()"
        x-cloak
      >
        <Button
          title="Edit"
          variant="secondary"
          grow
          @click="navigate(editPath())"
        />
        <Button
          title="Delete"
          variant="error"
          grow
          @click="requestDelete()"
        />
      </div>
    </div>
  </template>
  <div
    x-show="deleting"
    x-cloak
  >
    <ConfirmDialog
      titleId="routine-delete-title"
      title="Delete this routine?"
      description="Completed sessions keep their own record. The routine itself is removed."
      confirmLabel="Delete"
      confirmVariant="primary"
      onCancel="cancelDelete()"
      onConfirm="confirmDelete()"
      loadingExpr="deleteBusy"
    />
  </div>
</div>
```

`app/src/pages/training/routines/detail/index.astro`:

```astro
---
export const prerender = true;

import AppLayout from "@layouts/AppLayout.astro";
import RoutineDetail from "@components/layout/training/routines/RoutineDetail.astro";
---

<AppLayout title="Routine">
  <div
    class="p-4"
    x-data="routineDetail()"
  >
    <RoutineDetail />
  </div>
</AppLayout>
```

`app/src/pages/training/routines/play/index.astro`: move `app/src/pages/training/balanced-training/play/index.astro` here (`git mv`), change `title="Routine — Play"` and `x-data="routinePlay()"`. Then `git rm app/src/pages/training/balanced-training/index.astro`.

Add `routineDetail`/`trainingIndex` to whatever list `scripts/check-game-wiring.sh` or `check-astro-conventions.sh` reads for `x-data` names, only if they fail — read the failure first.

- [ ] **Step 8: Run tests and app gates**

```bash
cd app && npm test && npm run validate:app && cd ..
bash scripts/check-astro-conventions.sh && bash scripts/check-astro-class-composition.sh && bash scripts/check-style-tokens.sh && bash scripts/check-file-locations.sh
```

Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add -A app/src/lib/training/routines app/src/lib/client/alpine/register-route-data.ts app/src/pages/training app/src/components/layout/training/routines app/tests/lib/training/routines
git commit -m "feat(training): data-driven /training list, detail and play routes keyed by routine id; retire the static Balanced Training pages"
```

---

### Task 8: The builder

**Files:**
- Create: `app/src/lib/training/routines/routine-builder.data.ts`
- Modify: `app/src/lib/training/routines/types.ts` (`RoutineBuilderContext`, `BuilderStep`)
- Modify: `app/src/lib/client/alpine/register-route-data.ts`
- Create: `app/src/components/layout/training/routines/RoutineBuilder.astro`, `RoutineStepRow.astro`, `ExercisePicker.astro`
- Create: `app/src/pages/training/routines/new/index.astro`, `app/src/pages/training/routines/edit/index.astro`
- Test: `app/tests/lib/training/routines/routine-builder.data.test.ts`

**Interfaces:**
- Consumes: Task 2 `validateRoutineDuration` + `MIN_USER_ROUTINE_MINUTES`; Task 5 client module; Task 7 route helpers.
- Produces: Alpine factory `routineBuilder(mode: "create" | "edit")`.

- [ ] **Step 1: Failing tests**

`app/tests/lib/training/routines/routine-builder.data.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@client/api/routines", () => ({
  listExerciseTemplates: vi.fn(),
  getRoutine: vi.fn(),
  createRoutine: vi.fn(),
  updateRoutine: vi.fn(),
}));
import * as api from "@client/api/routines";
import { SessionApiError } from "@client/api/sessions";
import { routineBuilder } from "@lib/training/routines/routine-builder.data";

const CATALOG = [
  { exerciseTemplateId: "et-w", name: "Warm-Up", description: "d", exerciseTypeKey: "WARM_UP", gameTypeKey: null },
  { exerciseTemplateId: "et-f", name: "Finishing", description: "d", exerciseTypeKey: "GAME", gameTypeKey: "TUOD" },
];
const ROUTINE = {
  routineId: "o", routineName: "Mine", description: "desc", isSystemTemplate: false,
  steps: [
    { sequenceNumber: 1, exerciseTemplateId: "et-w", exerciseName: "Warm-Up", exerciseDescription: "d", exerciseTypeKey: "WARM_UP", gameTypeKey: null, durationValue: 20, durationTypeKey: "MINUTES" },
    { sequenceNumber: 2, exerciseTemplateId: "et-f", exerciseName: "Finishing", exerciseDescription: "d", exerciseTypeKey: "GAME", gameTypeKey: "TUOD", durationValue: 10, durationTypeKey: "MINUTES" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listExerciseTemplates).mockResolvedValue(CATALOG);
});

describe("routineBuilder (create)", () => {
  it("loads the catalog and starts empty and unsavable", async () => {
    const b = routineBuilder("create");
    await b.init();
    expect(b.catalog).toEqual(CATALOG);
    expect(b.steps).toEqual([]);
    expect(b.totalMinutes()).toBe(0);
    expect(b.canSave()).toBe(false);
  });

  it("adds a step with the 5-minute default and tracks the total", async () => {
    const b = routineBuilder("create");
    await b.init();
    b.addStep(CATALOG[0]);
    expect(b.steps).toEqual([{ exerciseTemplateId: "et-w", name: "Warm-Up", exerciseTypeKey: "WARM_UP", durationValue: 5 }]);
    b.setMinutes(0, 30);
    expect(b.totalMinutes()).toBe(30);
    b.name = "Mine";
    expect(b.canSave()).toBe(true);
  });

  it("moves and removes steps", async () => {
    const b = routineBuilder("create");
    await b.init();
    b.addStep(CATALOG[0]);
    b.addStep(CATALOG[1]);
    b.moveDown(0);
    expect(b.steps.map((s) => s.exerciseTemplateId)).toEqual(["et-f", "et-w"]);
    b.moveUp(1);
    expect(b.steps.map((s) => s.exerciseTemplateId)).toEqual(["et-w", "et-f"]);
    b.moveUp(0);
    expect(b.steps.map((s) => s.exerciseTemplateId)).toEqual(["et-w", "et-f"]);
    b.removeStep(0);
    expect(b.steps.map((s) => s.exerciseTemplateId)).toEqual(["et-f"]);
  });

  it("caps at 12 steps and clamps minutes to 1..60", async () => {
    const b = routineBuilder("create");
    await b.init();
    for (let i = 0; i < 13; i++) b.addStep(CATALOG[0]);
    expect(b.steps).toHaveLength(12);
    b.setMinutes(0, 0);
    expect(b.steps[0].durationValue).toBe(1);
    b.setMinutes(0, 99);
    expect(b.steps[0].durationValue).toBe(60);
    b.setMinutes(0, 7.9);
    expect(b.steps[0].durationValue).toBe(7);
  });

  it("names the rule when the total is outside 30..60", async () => {
    const b = routineBuilder("create");
    await b.init();
    b.addStep(CATALOG[0]);
    b.setMinutes(0, 10);
    b.name = "Mine";
    expect(b.canSave()).toBe(false);
    expect(b.durationIssues().join(" ")).toContain("minimum is 30");
  });

  it("POSTs on save and navigates to the new detail page", async () => {
    vi.mocked(api.createRoutine).mockResolvedValue({ ...ROUTINE, routineId: "new" });
    const b = routineBuilder("create");
    await b.init();
    b.name = "Mine";
    b.description = "";
    b.addStep(CATALOG[0]);
    b.setMinutes(0, 30);
    const nav = vi.fn();
    b.navigate = nav;
    await b.save();
    expect(api.createRoutine).toHaveBeenCalledWith({
      name: "Mine", description: null,
      steps: [{ exerciseTemplateId: "et-w", durationTypeKey: "MINUTES", durationValue: 30 }],
    });
    expect(nav).toHaveBeenCalledWith("/training/routines/detail?routine=new");
  });

  it("shows the envelope's issues on VALIDATION_FAILED", async () => {
    vi.mocked(api.createRoutine).mockRejectedValue(
      new SessionApiError("VALIDATION_FAILED", "bad", "r", { issues: ["routine is 20 minutes; the minimum is 30"] }),
    );
    const b = routineBuilder("create");
    await b.init();
    b.name = "Mine";
    b.addStep(CATALOG[0]);
    b.setMinutes(0, 30);
    await b.save();
    expect(b.serverIssues).toEqual(["routine is 20 minutes; the minimum is 30"]);
    expect(b.saving).toBe(false);
  });
});

describe("routineBuilder (edit)", () => {
  beforeEach(() => history.replaceState(null, "", "/training/routines/edit?routine=o"));

  it("loads the routine into state and PUTs on save", async () => {
    vi.mocked(api.getRoutine).mockResolvedValue(ROUTINE);
    vi.mocked(api.updateRoutine).mockResolvedValue(ROUTINE);
    const b = routineBuilder("edit");
    await b.init();
    expect(b.name).toBe("Mine");
    expect(b.description).toBe("desc");
    expect(b.steps.map((s) => [s.exerciseTemplateId, s.durationValue])).toEqual([["et-w", 20], ["et-f", 10]]);
    expect(b.totalMinutes()).toBe(30);
    const nav = vi.fn();
    b.navigate = nav;
    await b.save();
    expect(api.updateRoutine).toHaveBeenCalledWith("o", expect.objectContaining({ name: "Mine", description: "desc" }));
    expect(nav).toHaveBeenCalledWith("/training/routines/detail?routine=o");
  });

  it("refuses to edit a system routine", async () => {
    vi.mocked(api.getRoutine).mockResolvedValue({ ...ROUTINE, isSystemTemplate: true });
    const b = routineBuilder("edit");
    await b.init();
    expect(b.error).toContain("cannot be edited");
    expect(b.canSave()).toBe(false);
  });
});
```

- [ ] **Step 2: Run to see them fail**

```bash
cd app && npm test -- tests/lib/training/routines/routine-builder.data.test.ts
```

- [ ] **Step 3: Implement the data factory**

Add to `lib/training/routines/types.ts`:

```ts
export type BuilderStep = {
  exerciseTemplateId: string;
  name: string;
  exerciseTypeKey: string;
  durationValue: number;
};
export type RoutineBuilderContext = ReturnType<typeof routineBuilder>;
```

`routine-builder.data.ts`:

```ts
import {
  createRoutine,
  getRoutine,
  listExerciseTemplates,
  updateRoutine,
} from "@client/api/routines";
import { SessionApiError } from "@client/api/sessions";
import {
  MAX_ROUTINE_MINUTES,
  MIN_USER_ROUTINE_MINUTES,
  validateRoutineDuration,
} from "@modules/training/routines/routine-duration.module";
import { routineDetailPath, routineIdFromLocation } from "./routine-route";
import type { ExerciseTemplateCatalogEntryData } from "@client/api/types";
import type { BuilderStep, RoutineBuilderContext } from "./types";

export const MAX_BUILDER_STEPS = 12;
export const DEFAULT_STEP_MINUTES = 5;
const MIN_STEP_MINUTES = 1;
const MAX_STEP_MINUTES = 60;
const MAX_NAME_LENGTH = 60;

function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return MIN_STEP_MINUTES;
  return Math.min(MAX_STEP_MINUTES, Math.max(MIN_STEP_MINUTES, Math.floor(value)));
}

function swap(steps: BuilderStep[], a: number, b: number): BuilderStep[] {
  const next = [...steps];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/**
 * Builder state for `/training/routines/new` and `/edit`. Pre-validates with
 * the same module the service runs; the `0038` trigger is the guarantee behind
 * both. Lives in the page's `x-data`, not a store (`app/src/stores/CLAUDE.md`).
 */
export function routineBuilder(mode: "create" | "edit") {
  return {
    mode,
    routineId: null as string | null,
    loading: true,
    saving: false,
    error: "",
    serverIssues: [] as string[],
    name: "",
    description: "",
    catalog: [] as ExerciseTemplateCatalogEntryData[],
    steps: [] as BuilderStep[],
    minMinutes: MIN_USER_ROUTINE_MINUTES,
    maxMinutes: MAX_ROUTINE_MINUTES,

    navigate(path: string) {
      globalThis.location.href = path;
    },

    async init(this: RoutineBuilderContext) {
      this.loading = true;
      this.error = "";
      try {
        this.catalog = await listExerciseTemplates();
        if (this.mode === "edit") await this.loadExisting();
      } catch {
        this.error = "Could not load the exercise catalog.";
      } finally {
        this.loading = false;
      }
    },

    async loadExisting(this: RoutineBuilderContext) {
      const routineId = routineIdFromLocation();
      if (!routineId) {
        this.error = "No routine selected.";
        return;
      }
      const routine = await getRoutine(routineId);
      if (routine.isSystemTemplate) {
        this.error = "A system routine cannot be edited. Build your own instead.";
        return;
      }
      this.routineId = routine.routineId;
      this.name = routine.routineName;
      this.description = routine.description ?? "";
      this.steps = routine.steps.map((step) => ({
        exerciseTemplateId: step.exerciseTemplateId,
        name: step.exerciseName,
        exerciseTypeKey: step.exerciseTypeKey,
        durationValue: step.durationValue,
      }));
    },

    addStep(this: RoutineBuilderContext, entry: ExerciseTemplateCatalogEntryData) {
      if (this.steps.length >= MAX_BUILDER_STEPS) return;
      this.steps = [
        ...this.steps,
        {
          exerciseTemplateId: entry.exerciseTemplateId,
          name: entry.name,
          exerciseTypeKey: entry.exerciseTypeKey,
          durationValue: DEFAULT_STEP_MINUTES,
        },
      ];
    },

    removeStep(this: RoutineBuilderContext, index: number) {
      this.steps = this.steps.filter((_, i) => i !== index);
    },

    moveUp(this: RoutineBuilderContext, index: number) {
      if (index <= 0) return;
      this.steps = swap(this.steps, index, index - 1);
    },

    moveDown(this: RoutineBuilderContext, index: number) {
      if (index >= this.steps.length - 1) return;
      this.steps = swap(this.steps, index, index + 1);
    },

    setMinutes(this: RoutineBuilderContext, index: number, value: number) {
      const step = this.steps[index];
      if (!step) return;
      this.steps = this.steps.map((s, i) =>
        i === index ? { ...s, durationValue: clampMinutes(Number(value)) } : s,
      );
    },

    durationResult(this: RoutineBuilderContext) {
      return validateRoutineDuration(
        this.steps.map((step, index) => ({
          sequenceNumber: index + 1,
          durationTypeKey: "MINUTES" as const,
          durationValue: step.durationValue,
        })),
        { minMinutes: MIN_USER_ROUTINE_MINUTES },
      );
    },

    totalMinutes(this: RoutineBuilderContext): number {
      return this.steps.reduce((sum, step) => sum + step.durationValue, 0);
    },

    durationIssues(this: RoutineBuilderContext): string[] {
      const result = this.durationResult();
      return result.ok ? [] : result.issues;
    },

    nameValid(this: RoutineBuilderContext): boolean {
      const trimmed = this.name.trim();
      return trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH;
    },

    canSave(this: RoutineBuilderContext): boolean {
      if (this.saving || this.loading || this.error) return false;
      if (this.mode === "edit" && !this.routineId) return false;
      return this.nameValid() && this.durationResult().ok;
    },

    payload(this: RoutineBuilderContext) {
      return {
        name: this.name.trim(),
        description: this.description.trim() || null,
        steps: this.steps.map((step) => ({
          exerciseTemplateId: step.exerciseTemplateId,
          durationTypeKey: "MINUTES" as const,
          durationValue: step.durationValue,
        })),
      };
    },

    async save(this: RoutineBuilderContext) {
      if (!this.canSave()) return;
      this.saving = true;
      this.serverIssues = [];
      try {
        const saved =
          this.mode === "edit" && this.routineId
            ? await updateRoutine(this.routineId, this.payload())
            : await createRoutine(this.payload());
        this.navigate(routineDetailPath(saved.routineId));
      } catch (err) {
        if (err instanceof SessionApiError && err.code === "VALIDATION_FAILED") {
          const issues = err.details?.issues;
          this.serverIssues = Array.isArray(issues)
            ? issues.map(String)
            : [String(err.details?.reason ?? "The routine was not accepted.")];
        } else {
          this.error = "Could not save the routine. Check your connection and retry.";
        }
      } finally {
        this.saving = false;
      }
    },

    cancel(this: RoutineBuilderContext) {
      this.navigate(this.routineId ? routineDetailPath(this.routineId) : "/training");
    },
  };
}
```

Register in `register-route-data.ts`:

```ts
import { routineBuilder } from "@lib/training/routines/routine-builder.data";
…
  Alpine.data("routineBuilder", routineBuilder);
```

- [ ] **Step 4: Run to green**

```bash
cd app && npm test -- tests/lib/training/routines/routine-builder.data.test.ts
```

- [ ] **Step 5: Components and pages**

`ExercisePicker.astro`:

```astro
---
/**
 * The exercise catalog as tappable tiles; tapping appends a step
 * (`routineBuilder().addStep`). Reads `catalog`/`steps` from the parent scope.
 */
import Button from "@components/forms/Button.astro";
---

<section class="space-y-2">
  <h2 class="text-sm font-semibold text-foreground">Add an exercise</h2>
  <div class="grid grid-cols-2 gap-2">
    <template x-for="entry in catalog" :key="entry.exerciseTemplateId">
      <Button
        variant="dashed"
        grow
        class="flex-col items-start gap-0.5 text-left"
        :disabled="steps.length >= 12"
        @click="addStep(entry)"
        ariaLabel="Add exercise"
      >
        <span
          class="text-sm font-semibold text-foreground"
          x-text="entry.name"
        >
        </span>
        <span
          class="text-xs text-muted-foreground"
          x-text="entry.description ?? ''"
        >
        </span>
      </Button>
    </template>
  </div>
</section>
```

(If `Button.astro` renders `title` only and no slot, pass `:title="entry.name"` instead and drop the inner spans — check the component first; never hand-roll a `<button>`.)

`RoutineStepRow.astro`:

```astro
---
/**
 * One builder step: position, exercise name, minutes input, move/remove.
 * Reads `step`/`index` from the enclosing `x-for` and the builder's helpers.
 */
import Input from "@components/forms/Input.astro";
import IconBtn from "@components/forms/IconBtn.astro";
import ChevronDownIcon from "@icons/chevron-down.svg";
import CrossIcon from "@icons/cross.svg";
---

<li class="flex items-center gap-2 rounded-md border border-border p-2">
  <span
    class="w-6 text-sm font-semibold text-accent"
    x-text="index + 1"
  >
  </span>
  <span
    class="flex-1 text-sm text-foreground"
    x-text="step.name"
  >
  </span>
  <Input
    type="number"
    class="w-16 text-center"
    min="1"
    max="60"
    inputmode="numeric"
    :value="step.durationValue"
    @change="setMinutes(index, $event.target.valueAsNumber)"
    aria-label="Minutes"
  />
  <span class="text-xs text-muted-foreground">min</span>
  <IconBtn
    variant="ghost"
    class="p-1.5"
    ariaLabel="Move up"
    :disabled="index === 0"
    @click="moveUp(index)"
  >
    <ChevronDownIcon class="rotate-180" />
  </IconBtn>
  <IconBtn
    variant="ghost"
    class="p-1.5"
    ariaLabel="Move down"
    :disabled="index === steps.length - 1"
    @click="moveDown(index)"
  >
    <ChevronDownIcon />
  </IconBtn>
  <IconBtn
    variant="ghost"
    class="p-1.5"
    ariaLabel="Remove step"
    @click="removeStep(index)"
  >
    <CrossIcon />
  </IconBtn>
</li>
```

Only icons that exist under `app/src/icons/` are used (`chevron-down.svg` rotated for "up", `cross.svg`); add no SVGs.

`RoutineBuilder.astro`:

```astro
---
/**
 * Builder body for create and edit. The page mounts `routineBuilder(mode)`;
 * this renders header inputs, the step list, the picker and the footer.
 */
import Input from "@components/forms/Input.astro";
import Button from "@components/forms/Button.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
import RoutineStepRow from "./RoutineStepRow.astro";
import ExercisePicker from "./ExercisePicker.astro";
---

<div class="space-y-6">
  <ErrorAlert />
  <div class="space-y-2">
    <Input
      name="routine-name"
      placeholder="Routine name"
      maxlength="60"
      x-model="name"
    />
    <Input
      name="routine-description"
      placeholder="Description (optional)"
      maxlength="280"
      x-model="description"
    />
  </div>

  <section class="space-y-2">
    <h2 class="text-sm font-semibold text-foreground">Steps</h2>
    <p
      class="text-sm text-muted-foreground"
      x-show="steps.length === 0"
      x-cloak
    >
      No steps yet — add an exercise below.
    </p>
    <ol class="space-y-2">
      <template x-for="(step, index) in steps" :key="index">
        <RoutineStepRow />
      </template>
    </ol>
  </section>

  <ExercisePicker />

  <footer class="space-y-2">
    <div class="flex items-center justify-between text-sm">
      <span class="text-muted-foreground">Total</span>
      <span
        class="font-semibold text-foreground"
        x-text="`${totalMinutes()} min`"
      >
      </span>
    </div>
    <p
      class="text-xs text-muted-foreground"
      x-text="`A routine runs between ${minMinutes} and ${maxMinutes} minutes.`"
    >
    </p>
    <ul
      class="text-xs text-error"
      x-show="durationIssues().length > 0 || serverIssues.length > 0"
      x-cloak
    >
      <template x-for="issue in [...durationIssues(), ...serverIssues]" :key="issue">
        <li x-text="issue"></li>
      </template>
    </ul>
    <div class="flex gap-2">
      <Button
        title="Cancel"
        variant="secondary"
        grow
        @click="cancel()"
      />
      <Button
        title="Save"
        variant="primary"
        grow
        :disabled="!canSave()"
        loadingExpr="saving"
        @click="save()"
      />
    </div>
  </footer>
</div>
```

`app/src/pages/training/routines/new/index.astro`:

```astro
---
export const prerender = true;

import AppLayout from "@layouts/AppLayout.astro";
import RoutineBuilder from "@components/layout/training/routines/RoutineBuilder.astro";
---

<AppLayout title="New routine">
  <div
    class="p-4 space-y-4"
    x-data="routineBuilder('create')"
  >
    <h1 class="text-xl font-semibold text-foreground">New routine</h1>
    <RoutineBuilder />
  </div>
</AppLayout>
```

`edit/index.astro` is identical with `title="Edit routine"`, heading "Edit routine", `x-data="routineBuilder('edit')"`.

- [ ] **Step 6: Run the app gates**

```bash
cd app && npm test && npm run validate:app && npm run format && cd ..
bash scripts/check-astro-conventions.sh && bash scripts/check-astro-class-composition.sh && bash scripts/check-style-tokens.sh && bash scripts/check-file-locations.sh && bash scripts/check-test-coverage.sh
```

Then `cd app && npm run dev` (background) and walk: `/training` → New routine → add Warm-Up 10, Switching 10, Finishing 10 → Save → detail → Start → the Balanced-Training flow runs → summary. Edit the routine to 25 minutes and confirm Save is disabled with the floor message.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/training/routines app/src/lib/client/alpine/register-route-data.ts app/src/components/layout/training/routines app/src/pages/training/routines app/tests/lib/training/routines
git commit -m "feat(training): routine builder — catalog picker, ordered steps with move/remove, 30–60 min pre-validation, create and edit"
```

---

### Task 9: Documentation, decisions, inventory, gates

**Files:**
- Modify: `docs/architecture/05-Database/06-Spec/02-Template-Layer.md` (routine_templates / routine_steps sections: ownership CHECK, trigger, "planned" → shipped), `05-Views/00-Overview.md` (view table rows for `v_routine_execution` (0038) and `v_exercise_template_catalog`), `03-Migrations.md` (a `## 0038_custom_routines.sql` section after `0037`; leave the #288 gap), `10-Database-Agent-Guide.md` (chain `0001`–`0038`; first trigger noted), `database/CLAUDE.md` checklist range, root `CLAUDE.md` migration range, `00-Context-Map.md` two range mentions
- Modify: `docs/architecture/06-API/04-Endpoint-Contracts.md` (drop "(not implemented)" / "(planned…)" on the routine rows and the write section title; `POST /api/training-sessions` row now current), `06-API/00-Overview.md` (route surface)
- Modify: `docs/architecture/09-Training/01-Routines.md` §7 "User-Created Routine Floor" and §20 status → shipped (migration `0038`)
- Modify: `docs/architecture/07-Frontend/00-Overview.md` (builder paragraph present tense; reorder = move buttons; `@alpinejs/sort` not adopted), `08-Component-Inventory.md` (`RoutineDetail.astro` row rewritten; rows for `RoutineCard`, `RoutineBuilder`, `RoutineStepRow`, `ExercisePicker`), `02-Folder-Structure.md` if it enumerates `pages/training/`
- Modify: `decisions/database.md` (new block: first constraint trigger + its error classification), `decisions/frontend/alpine.md` (new block: reorder by move buttons, `@alpinejs/sort` declined for now)
- Modify: `docs/architecture/00-File-Inventory.md` (rows for every new doc-relevant file), `00-Context-Map-History.md` (version entry)
- Modify: `app/src/modules/training/routines/routine-duration.module.ts` comment (done in Task 2 — verify)

- [ ] **Step 1: Derive decision ids**

```bash
git fetch origin && bash scripts/next-decision-id.sh
```

Use the printed id for the database decision and the next for the Alpine one.

- [ ] **Step 2: Append the two decision blocks** (format per `DECISIONS.md` "How to add a decision"; cite D305, D306, D320; `Consequences:` names the trigger name the service matches and that `routine-duration.module.ts` is the shared pre-check).

- [ ] **Step 3: Targeted doc edits** listed above — minimal diffs, ISO dates on each changed row, never regenerate a file.

- [ ] **Step 4: Inventory and history**

Add File Inventory rows (2026-09-xx) for: `0038` migration, seed `0020`, verification `0038`, `routine.service.ts`, `routine.repository.ts`, the two API folders, `routines.ts` client module, the four `lib/training/routines/*.data.ts`/`routine-route.ts`, the four components, the four pages. Append a `00-Context-Map-History.md` entry (`custom-routine-builder`).

- [ ] **Step 5: Gates**

Run the `context-maintenance` skill steps 1–9, then the `run-all-gates` skill (all three sections apply: `app/`, `database/`, `decisions/`). Fix anything red at its cause.

- [ ] **Step 6: Discovered work**

File `discovered-work` issues (per `capturing-discovered-work`) for anything noticed and not in scope — at minimum check: `apiRequest` 204 handling if it was pre-existing, `schema.ts` hand-maintenance (#404 — comment, do not duplicate), and `03-Migrations.md`'s per-migration gap (#288 — comment only).

- [ ] **Step 7: Commit**

```bash
git add docs decisions CLAUDE.md database/CLAUDE.md
git commit -m "docs: custom routine builder shipped — template layer, views, API contracts, frontend handbook, decisions (D305/D306/D320 realised)"
```

Report: branch name, commits, gate results, issues filed, and that the PR is opened only on the user's word (`finishing-a-dart-branch`).

---

## Self-review against the spec

- §3.1–3.6 → Task 1. §4.1–4.3 → Tasks 3–5. §4.4 → Task 6. §5 → Task 5 (+ Task 6 row). §6.1 → Task 7. §6.2–6.4 → Task 8. §7 test table → each task's tests (module T2, service T4/T6, repository T3/T6, pages/api T5/T6, lib T7/T8, db T1). §8 → Task 9. §9 risks: #404 handled in T1 Step 6; deploy order safe; name collisions accepted; Phase 3 hook untouched.
- Placeholders: none — every step carries the code or the exact edit.
- Names used consistently: `findRoutineExecutionRows`, `findExerciseTemplateCatalog`, `insertRoutineStepRecords`, `updateRoutineTemplateRecord`, `deleteRoutineTemplateRecord`, `routinePlay`, `routineDetail`, `trainingIndex`, `routineBuilder`, `routineIdFromLocation`, `routineDetailPath`, `routinePlayPath`, `routineEditPath`, `MIN_USER_ROUTINE_MINUTES`.
