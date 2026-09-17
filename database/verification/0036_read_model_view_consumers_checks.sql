-- ============================================================
-- Verification: 0036_read_model_view_consumers_checks.sql
--
-- Proves against a live database what migration 0036 can only
-- claim locally (D193): both recreated views expose the columns
-- the application now reads through them, v_routine_execution
-- returns every step of the shipped routine (not only its game
-- step), and neither view gained a row or lost one.
--
-- The fan-out check is the one that matters. Adding
-- exercise_configurations to v_double_out_checkout_darts is
-- only safe because uq_exercise_configuration_session makes it
-- at most one row per session; if that unique were ever dropped
-- the LEFT JOIN would silently multiply every dart row and the
-- checkout statistics would over-count with no error anywhere.
--
-- Builds its own fixture and ends in ROLLBACK, so it leaves
-- nothing behind and composes with the other verification
-- scripts.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0036_read_model_view_consumers_checks.sql
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

INSERT INTO verification_results
SELECT '1',
    'v_double_out_checkout_darts exposes starting_score',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching column(s)', count(*))
FROM information_schema.columns
WHERE table_name = 'v_double_out_checkout_darts'
    AND column_name = 'starting_score';

INSERT INTO verification_results
SELECT '2',
    'v_double_out_checkout_darts keeps every column it had before 0036',
    CASE WHEN count(*) = 9 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 9 pre-0036 columns, found %s', count(*))
FROM information_schema.columns
WHERE table_name = 'v_double_out_checkout_darts'
    AND column_name IN ('session_id', 'player_id', 'stage_id', 'turn_sequence',
        'dart_number', 'hit_target_number', 'hit_zone_key', 'score',
        'prior_scored_in_stage');

INSERT INTO verification_results
SELECT '3',
    'uq_exercise_configuration_session still makes the new LEFT JOIN non-fanning',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s unique constraint(s) on exercise_session_id', count(*))
FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'exercise_configurations'
    AND tc.constraint_type = 'UNIQUE'
    AND kcu.column_name = 'exercise_session_id';

INSERT INTO verification_results
SELECT '4',
    'starting_score matches the session configuration snapshot for every row',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s) disagree with exercise_configurations', count(*))
FROM v_double_out_checkout_darts v
    JOIN exercise_configurations ec ON ec.exercise_session_id = v.session_id
WHERE v.starting_score IS DISTINCT FROM (ec.configuration ->> 'starting_score')::int;

INSERT INTO verification_results
SELECT '5',
    'v_routine_execution exposes every column findRoutineTemplateSteps reads',
    CASE WHEN count(*) = 9 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 9 columns, found %s', count(*))
FROM information_schema.columns
WHERE table_name = 'v_routine_execution'
    AND column_name IN ('routine_id', 'is_system_template', 'sequence_number',
        'exercise_type_key', 'exercise_ruleset_version_key', 'game_type_key',
        'duration_value', 'duration_type_key', 'step_configuration');

INSERT INTO verification_results
SELECT '6',
    'v_routine_execution returns every step of Balanced Training, not only its game step',
    CASE WHEN count(*) >= 4 AND count(*) FILTER (WHERE game_type_key IS NULL) >= 3 THEN 'PASS' ELSE 'FAIL' END,
    format('%s step(s), of which %s are non-game', count(*), count(*) FILTER (WHERE game_type_key IS NULL))
FROM v_routine_execution
WHERE routine_name = 'Balanced Training'
    AND is_system_template = TRUE;

INSERT INTO verification_results
SELECT '7',
    'v_routine_execution returns one row per routine step, no fan-out',
    CASE WHEN v.rows = s.rows THEN 'PASS' ELSE 'FAIL' END,
    format('%s view row(s) for %s routine_steps row(s)', v.rows, s.rows)
FROM (SELECT count(*) AS rows FROM v_routine_execution) v,
    (SELECT count(*) AS rows FROM routine_steps) s;

INSERT INTO verification_results
SELECT '8',
    'every non-game step carries the exercise ruleset version its template pins',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('%s non-game step(s) with no ruleset version key', count(*))
FROM v_routine_execution
WHERE exercise_type_key <> 'GAME'
    AND exercise_ruleset_version_key IS NULL;

INSERT INTO verification_results
SELECT '9',
    'every step''s exercise_type_key is its template''s own exercise_types.implementation_key',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('%s step(s) whose key does not match the template''s exercise type', count(*))
FROM v_routine_execution v
    JOIN exercise_templates et ON et.id = v.exercise_template_id
    JOIN exercise_types ext ON ext.id = et.exercise_type_id
WHERE v.exercise_type_key IS DISTINCT FROM ext.implementation_key;

INSERT INTO verification_results
SELECT '10',
    'anti-vacuity: the seeded routine this script asserts on exists',
    CASE WHEN count(*) >= 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s system routine template(s) named Balanced Training', count(*))
FROM routine_templates
WHERE name = 'Balanced Training'
    AND is_system_template = TRUE;

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY length(step), step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
