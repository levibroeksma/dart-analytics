-- ============================================================
-- Verification: 0059_doubles_lock_variants_checks.sql
--
-- Proves against a live database what 0059_doubles_lock_variants.sql
-- can only claim locally: the three variant templates are system
-- templates of DOUBLES_LOCK, pin DOUBLES_LOCK_V1 with their path
-- configuration, and reach the routine builder through
-- v_exercise_template_catalog.
--
-- Reads seeded rows only and ends in ROLLBACK.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0059_doubles_lock_variants_checks.sql
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

CREATE TEMP TABLE expected (
    template_name TEXT NOT NULL,
    configuration JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO expected VALUES
    ('Doubles Lock: Even', '{"doubles":"EVEN"}'),
    ('Doubles Lock: Ascending', '{"order":"ASCENDING"}'),
    ('Doubles Lock: Even Ascending', '{"order":"ASCENDING","doubles":"EVEN"}');

INSERT INTO verification_results
SELECT '1',
    format('%s is a system template pinning DOUBLES_LOCK_V1 with its path', e.template_name),
    CASE WHEN count(t.id) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching template(s)', count(t.id))
FROM expected e
    LEFT JOIN exercise_types et ON et.implementation_key = 'DOUBLES_LOCK'
    LEFT JOIN exercise_ruleset_versions erv ON erv.implementation_key = 'DOUBLES_LOCK_V1'
    LEFT JOIN exercise_templates t ON t.name = e.template_name
        AND t.exercise_type_id = et.id
        AND t.exercise_ruleset_version_id = erv.id
        AND t.is_system_template
        AND t.game_type_id IS NULL
        AND t.default_configuration = e.configuration
GROUP BY e.template_name;

INSERT INTO verification_results
SELECT '2',
    'DOUBLES_LOCK owns exactly one ruleset version, DOUBLES_LOCK_V1',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s version(s)', count(*))
FROM exercise_ruleset_versions erv
    JOIN exercise_types et ON et.id = erv.exercise_type_id
WHERE et.implementation_key = 'DOUBLES_LOCK';

INSERT INTO verification_results
SELECT '3',
    'v_exercise_template_catalog offers all four Doubles Lock templates',
    CASE WHEN count(*) = 4 THEN 'PASS' ELSE 'FAIL' END,
    format('%s catalog row(s)', count(*))
FROM v_exercise_template_catalog c
WHERE c.exercise_type_key = 'DOUBLES_LOCK'
    AND c.has_default_configuration;

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY length(step), step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
