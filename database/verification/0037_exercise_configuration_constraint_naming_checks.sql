-- ============================================================
-- Verification: 0037_exercise_configuration_constraint_naming_checks.sql
--
-- Proves against a live database (D193) that migration 0037's
-- RENAME CONSTRAINT calls landed: exercise_configurations carries
-- uq_exercise_configurations_exercise_session and
-- fk_exercise_configurations_exercise_session, and neither of the
-- pre-rename names (uq_exercise_configuration_session,
-- fk_exercise_configuration_session) survives under any
-- constraint type. Migration 0037 was committed unapplied -- no
-- DATABASE_URL reaches this environment -- so this script is the
-- only artifact that will ever confirm the rename against a real
-- catalog, once someone with database access runs it.
--
-- Catalog-only: no fixture, no seeded row, nothing to insert.
-- Still wrapped in BEGIN/ROLLBACK so it composes with the other
-- verification scripts and leaves nothing behind.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0037_exercise_configuration_constraint_naming_checks.sql
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
    'uq_exercise_configurations_exercise_session exists on exercise_configurations.exercise_session_id',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching constraint(s) on exercise_session_id', count(*))
FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'exercise_configurations'
    AND tc.constraint_type = 'UNIQUE'
    AND tc.constraint_name = 'uq_exercise_configurations_exercise_session'
    AND kcu.column_name = 'exercise_session_id';

INSERT INTO verification_results
SELECT '2',
    'fk_exercise_configurations_exercise_session exists on exercise_configurations.exercise_session_id',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching constraint(s) on exercise_session_id', count(*))
FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'exercise_configurations'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.constraint_name = 'fk_exercise_configurations_exercise_session'
    AND kcu.column_name = 'exercise_session_id';

INSERT INTO verification_results
SELECT '3',
    'neither pre-rename constraint name still exists on exercise_configurations',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching constraint(s)', count(*))
FROM information_schema.table_constraints
WHERE table_name = 'exercise_configurations'
    AND constraint_name IN ('uq_exercise_configuration_session', 'fk_exercise_configuration_session');

INSERT INTO verification_results
SELECT '4',
    'anti-vacuity: exercise_configurations exists so the checks above are not vacuous',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching table(s)', count(*))
FROM information_schema.tables
WHERE table_name = 'exercise_configurations';

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY length(step), step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
