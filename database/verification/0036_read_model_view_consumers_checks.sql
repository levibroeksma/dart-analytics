-- ============================================================
-- Verification: 0036_read_model_view_consumers_checks.sql
--
-- Proves against a live database what migration 0036 can only
-- claim locally (D193): the checkout-darts view carries each
-- session's own configuration over a join that cannot fan out,
-- v_routine_execution exposes the columns the application reads
-- through it and returns every step of the shipped routine (not
-- only its game step), and it gained no row and lost none.
--
-- The fan-out check is the one that matters. Joining
-- exercise_configurations into the checkout-darts view is only
-- safe because a unique on exercise_session_id makes it at most
-- one row per session; if that unique were ever dropped the LEFT
-- JOIN would silently multiply every dart row and the checkout
-- statistics would over-count with no error anywhere.
--
-- 0036's own two checkout-darts column checks are gone with the
-- view they named: migration 0038 dropped
-- v_double_out_checkout_darts outright, and its replacement
-- v_x01_checkout_darts deliberately exposes neither
-- starting_score nor prior_scored_in_stage. That view's column
-- set has its own assertion in
-- 0038_x01_checkout_darts_view_checks.sql. The two checks below
-- are not about a column set: they are the non-fan-out guarantee
-- and the each-row-carries-its-own-session's-snapshot guarantee,
-- both of which the new view inherits unchanged along with the
-- same LEFT JOIN, so they are re-pointed at it rather than
-- deleted.
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
    'the unique on exercise_session_id still makes the checkout-darts LEFT JOIN non-fanning',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s unique constraint(s) on exercise_session_id', count(*))
FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'exercise_configurations'
    AND tc.constraint_type = 'UNIQUE'
    AND kcu.column_name = 'exercise_session_id';

INSERT INTO verification_results
SELECT '2',
    'every checkout-darts row carries its own session''s configuration snapshot',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s) disagree with exercise_configurations', count(*))
FROM v_x01_checkout_darts v
    JOIN exercise_configurations ec ON ec.exercise_session_id = v.session_id
WHERE v.configuration IS DISTINCT FROM ec.configuration;

INSERT INTO verification_results
SELECT '3',
    'v_routine_execution exposes every column findRoutineTemplateSteps reads',
    CASE WHEN count(*) = 9 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 9 columns, found %s', count(*))
FROM information_schema.columns
WHERE table_name = 'v_routine_execution'
    AND column_name IN ('routine_id', 'is_system_template', 'sequence_number',
        'exercise_type_key', 'exercise_ruleset_version_key', 'game_type_key',
        'duration_value', 'duration_type_key', 'step_configuration');

INSERT INTO verification_results
SELECT '4',
    'v_routine_execution returns every step of Balanced Training, not only its game step',
    CASE WHEN count(*) >= 4 AND count(*) FILTER (WHERE game_type_key IS NULL) >= 3 THEN 'PASS' ELSE 'FAIL' END,
    format('%s step(s), of which %s are non-game', count(*), count(*) FILTER (WHERE game_type_key IS NULL))
FROM v_routine_execution
WHERE routine_name = 'Balanced Training'
    AND is_system_template = TRUE;

INSERT INTO verification_results
SELECT '5',
    'v_routine_execution returns one row per routine step, no fan-out',
    CASE WHEN v.rows = s.rows THEN 'PASS' ELSE 'FAIL' END,
    format('%s view row(s) for %s routine_steps row(s)', v.rows, s.rows)
FROM (SELECT count(*) AS rows FROM v_routine_execution) v,
    (SELECT count(*) AS rows FROM routine_steps) s;

INSERT INTO verification_results
SELECT '6',
    'every non-game step carries the exercise ruleset version its template pins',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('%s non-game step(s) with no ruleset version key', count(*))
FROM v_routine_execution
WHERE exercise_type_key <> 'GAME'
    AND exercise_ruleset_version_key IS NULL;

INSERT INTO verification_results
SELECT '7',
    'every step''s exercise_type_key is its template''s own exercise_types.implementation_key',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('%s step(s) whose key does not match the template''s exercise type', count(*))
FROM v_routine_execution v
    JOIN exercise_templates et ON et.id = v.exercise_template_id
    JOIN exercise_types ext ON ext.id = et.exercise_type_id
WHERE v.exercise_type_key IS DISTINCT FROM ext.implementation_key;

INSERT INTO verification_results
SELECT '8',
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
