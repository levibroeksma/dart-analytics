-- ============================================================
-- Verification: 0015_warm_up_routine_checks.sql
--
-- Proves against a live database (D193) that seeds 0014 and
-- 0015 landed and resolve end to end: the routine has exactly
-- one step, that step's exercise template is a WARM_UP template
-- with no game type, its default_configuration holds five
-- phases, and no exercise_sessions row was left without an
-- exercise type by the backfill.
--
-- Asserts against seeded data rather than building a fixture,
-- like 0007_capability_seed_checks.sql. Still wrapped in
-- BEGIN/ROLLBACK per house style.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0015_warm_up_routine_checks.sql
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

INSERT INTO verification_results
SELECT '1',
    'exercise types GAME and WARM_UP are seeded',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s of 2', count(*))
FROM exercise_types
WHERE implementation_key IN ('GAME', 'WARM_UP');

INSERT INTO verification_results
SELECT '2',
    'WARM_UP_V1 resolves to the WARM_UP exercise type',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s', count(*))
FROM exercise_ruleset_versions erv
    JOIN exercise_types et ON et.id = erv.exercise_type_id
WHERE erv.implementation_key = 'WARM_UP_V1'
    AND et.implementation_key = 'WARM_UP';

INSERT INTO verification_results
SELECT '3',
    'EXERCISE_SECTION stage type is seeded at id 6',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s', count(*))
FROM stage_types
WHERE id = 6
    AND implementation_key = 'EXERCISE_SECTION';

INSERT INTO verification_results
SELECT '4',
    'the system Warm-Up routine has exactly one step',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s step(s)', count(*))
FROM routine_steps rs
    JOIN routine_templates rt ON rt.id = rs.routine_template_id
WHERE rt.name = 'Warm-Up'
    AND rt.is_system_template
    AND rt.player_id IS NULL;

INSERT INTO verification_results
SELECT '5',
    'the step''s exercise template is WARM_UP with no game type',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s', count(*))
FROM routine_steps rs
    JOIN routine_templates rt ON rt.id = rs.routine_template_id
    JOIN exercise_templates et ON et.id = rs.exercise_template_id
    JOIN exercise_types ext ON ext.id = et.exercise_type_id
WHERE rt.name = 'Warm-Up'
    AND ext.implementation_key = 'WARM_UP'
    AND et.game_type_id IS NULL;

INSERT INTO verification_results
SELECT '6',
    'the exercise template declares five phases',
    CASE WHEN jsonb_array_length(default_configuration -> 'phases') = 5 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s phase(s)', jsonb_array_length(default_configuration -> 'phases'))
FROM exercise_templates
WHERE id = '0199b000-0000-7000-8000-000000000001';

INSERT INTO verification_results
SELECT '7',
    'no exercise_sessions row is missing an exercise type',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s) still NULL', count(*))
FROM exercise_sessions
WHERE exercise_type_id IS NULL;

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
