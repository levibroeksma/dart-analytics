-- ============================================================
-- Verification: 0031_remove_default_routines_checks.sql
--
-- Proves against a live database (D193) that seed 0031 removed
-- the "Standard Practice" and standalone "Warm-Up" system
-- routines, left no orphan steps, and kept the Warm-Up exercise
-- template that Balanced Training still uses.
--
-- A routine a training schedule still names is kept by the seed
-- (FK RESTRICT); check 1 reports it by name so the FAIL says why.
--
-- Asserts against seeded data rather than building a fixture,
-- like 0015_warm_up_routine_checks.sql. Still wrapped in
-- BEGIN/ROLLBACK per house style.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0031_remove_default_routines_checks.sql
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
    'Standard Practice and Warm-Up system routines are gone',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s: %s', count(*), COALESCE(string_agg(name, ', '), 'none'))
FROM routine_templates
WHERE id IN (
        '0198f400-0000-7000-8000-000000000001',
        '0199c000-0000-7000-8000-000000000001'
    );

INSERT INTO verification_results
SELECT '2',
    'no routine steps remain for the removed routines',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s step(s)', count(*))
FROM routine_steps
WHERE routine_template_id IN (
        '0198f400-0000-7000-8000-000000000001',
        '0199c000-0000-7000-8000-000000000001'
    );

INSERT INTO verification_results
SELECT '3',
    'the Warm-Up exercise template is kept as a WARM_UP template',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('found %s', count(*))
FROM exercise_templates et
    JOIN exercise_types ext ON ext.id = et.exercise_type_id
WHERE et.id = '0199b000-0000-7000-8000-000000000001'
    AND ext.implementation_key = 'WARM_UP';

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
