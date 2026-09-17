-- ============================================================
-- Verification: 0017_balanced_training_checks.sql
--
-- Proves against a live database (D193) that seeds 0016 and
-- 0017 landed and resolve end to end, covering both seeds in
-- one script the way 0015_warm_up_routine_checks.sql covers
-- 0014 and 0015.
--
-- The check that matters most is step 3. Seed 0017 is the only
-- seed in the repo that mutates an already-seeded row's JSONB
-- in place — the Warm-Up template's default_configuration, from
-- durationSeconds-per-phase to weight-per-phase. An INSERT that
-- misses is visible as a missing row; an UPDATE whose WHERE
-- clause matches nothing is silent, and nothing else in the
-- repo would notice.
--
-- Asserts against seeded data rather than building a fixture,
-- like 0007_capability_seed_checks.sql and 0015's. Still
-- wrapped in BEGIN/ROLLBACK per house style.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0017_balanced_training_checks.sql
--
-- Expected: every result row reads PASS. Run after
-- `npm run db:seed`.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Step 1: seed 0016's catalog rows.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'exercise types SWITCHING and DOUBLE_PATTERN are seeded',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s of 2', count(*))
FROM exercise_types
WHERE implementation_key IN ('SWITCHING', 'DOUBLE_PATTERN');

INSERT INTO verification_results
SELECT '2',
    'SWITCHING_V1 and DOUBLE_PATTERN_V1 resolve to their own exercise types',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s of 2', count(*))
FROM exercise_ruleset_versions erv
    JOIN exercise_types et ON et.id = erv.exercise_type_id
WHERE (erv.implementation_key, et.implementation_key) IN (
        ('SWITCHING_V1', 'SWITCHING'),
        ('DOUBLE_PATTERN_V1', 'DOUBLE_PATTERN')
    );

-- ------------------------------------------------------------
-- Step 3: seed 0017's in-place UPDATE of the Warm-Up template.
--
-- Split into three checks rather than one so a partial result is
-- readable: the phases survived, every phase gained weight, and
-- no phase still carries the durationSeconds key it replaced. A
-- WHERE clause that matched nothing leaves all three FAILing.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    'the Warm-Up template still declares five phases',
    CASE WHEN jsonb_array_length(default_configuration -> 'phases') = 5 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s phase(s)', jsonb_array_length(default_configuration -> 'phases'))
FROM exercise_templates
WHERE id = '0199b000-0000-7000-8000-000000000001';

INSERT INTO verification_results
SELECT '3',
    'every Warm-Up phase carries a weight',
    CASE WHEN count(*) FILTER (WHERE phase -> 'weight' IS NOT NULL) = count(*) AND count(*) > 0 THEN 'PASS' ELSE 'FAIL' END,
    format('%s of %s phase(s) have weight', count(*) FILTER (WHERE phase -> 'weight' IS NOT NULL), count(*))
FROM exercise_templates et,
    jsonb_array_elements(et.default_configuration -> 'phases') AS phase
WHERE et.id = '0199b000-0000-7000-8000-000000000001';

INSERT INTO verification_results
SELECT '3',
    'no Warm-Up phase still carries durationSeconds',
    CASE WHEN count(*) FILTER (WHERE phase -> 'durationSeconds' IS NOT NULL) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('%s phase(s) still have durationSeconds', count(*) FILTER (WHERE phase -> 'durationSeconds' IS NOT NULL))
FROM exercise_templates et,
    jsonb_array_elements(et.default_configuration -> 'phases') AS phase
WHERE et.id = '0199b000-0000-7000-8000-000000000001';

-- ------------------------------------------------------------
-- Step 4: the Balanced Training routine resolves end to end.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4',
    'the system Balanced Training routine has exactly four steps',
    CASE WHEN count(*) = 4 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s step(s)', count(*))
FROM routine_steps rs
    JOIN routine_templates rt ON rt.id = rs.routine_template_id
WHERE rt.name = 'Balanced Training'
    AND rt.is_system_template
    AND rt.player_id IS NULL;

INSERT INTO verification_results
SELECT '4',
    'every Balanced Training step is measured in MINUTES and sums to 30',
    CASE WHEN total = 30 AND non_minutes = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('%s minute(s) across %s step(s), %s not in MINUTES', total, steps, non_minutes)
FROM (
        SELECT coalesce(sum(rs.duration_value), 0) AS total,
            count(*) AS steps,
            count(*) FILTER (WHERE dt.implementation_key IS DISTINCT FROM 'MINUTES') AS non_minutes
        FROM routine_steps rs
            JOIN routine_templates rt ON rt.id = rs.routine_template_id
            LEFT JOIN duration_types dt ON dt.id = rs.duration_type_id
        WHERE rt.name = 'Balanced Training'
            AND rt.is_system_template
    ) totals;

INSERT INTO verification_results
SELECT '4',
    'all four steps resolve to distinct seeded exercise templates',
    CASE WHEN count(DISTINCT et.id) = 4 THEN 'PASS' ELSE 'FAIL' END,
    format('%s distinct template(s) resolved', count(DISTINCT et.id))
FROM routine_steps rs
    JOIN routine_templates rt ON rt.id = rs.routine_template_id
    JOIN exercise_templates et ON et.id = rs.exercise_template_id
WHERE rt.name = 'Balanced Training'
    AND rt.is_system_template;

-- ------------------------------------------------------------
-- Step 5: the Finishing step's configuration parses as TuodConfig.
--
-- TuodConfig (app/src/lib/game/rulesets/types.ts) is .strict(),
-- so the snapshot must hold exactly these six keys — a seventh
-- key fails the schema as surely as a missing one. SQL cannot
-- import the Zod object, so the key set is transcribed here.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '5',
    'the Finishing step''s configuration holds exactly TuodConfig''s six keys',
    CASE
        WHEN (
            SELECT array_agg(key ORDER BY key)
            FROM jsonb_object_keys(rs.configuration) AS key
        ) = ARRAY [
            'duration_type', 'duration_value', 'finish_bonus',
            'max_darts_per_turn', 'miss_penalty', 'starting_target'
        ] THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('keys: %s', (
            SELECT string_agg(key, ', ' ORDER BY key)
            FROM jsonb_object_keys(rs.configuration) AS key
        ))
FROM routine_steps rs
    JOIN routine_templates rt ON rt.id = rs.routine_template_id
    JOIN exercise_templates et ON et.id = rs.exercise_template_id
    JOIN game_types gt ON gt.id = et.game_type_id
WHERE rt.name = 'Balanced Training'
    AND gt.implementation_key = 'TUOD';

INSERT INTO verification_results
SELECT '5',
    'the Finishing step binds the TUOD game type',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s TUOD-bound step(s)', count(*))
FROM routine_steps rs
    JOIN routine_templates rt ON rt.id = rs.routine_template_id
    JOIN exercise_templates et ON et.id = rs.exercise_template_id
    JOIN game_types gt ON gt.id = et.game_type_id
WHERE rt.name = 'Balanced Training'
    AND rt.is_system_template
    AND gt.implementation_key = 'TUOD';

-- ------------------------------------------------------------
-- Step 6: anti-vacuity guard.
--
-- Several checks above are driven by a lookup that returns no
-- row at all when the thing it looks up is missing — a check
-- that never ran would otherwise be indistinguishable from one
-- that passed. The expected total is asserted directly. Adding
-- a check above means bumping this number.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '6',
    'all 10 checks above actually ran',
    CASE WHEN count(*) = 10 THEN 'PASS' ELSE 'FAIL' END,
    format('%s of 10 checks ran', count(*))
FROM verification_results;

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
