-- ============================================================
-- Verification: 0047_exercise_type_seed_checks.sql
--
-- Proves against a live database what each Track exercise seed
-- (0038 HIT_COUNT, 0039 SWITCHBLADE, 0040 DOUBLES_LOCK,
-- 0047 HALVE_IT) can only claim locally: the type is published,
-- its v1 ruleset belongs to it, the system template pins that
-- ruleset with its default configuration, and the template
-- reaches the routine builder through v_exercise_template_catalog.
-- A new exercise seed adds one row to `expected`.
--
-- Reads seeded rows only and ends in ROLLBACK.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0047_exercise_type_seed_checks.sql
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
    type_key TEXT NOT NULL,
    ruleset_key TEXT NOT NULL,
    configuration JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO expected VALUES
    ('HIT_COUNT', 'HIT_COUNT_V1', '{"targets":[{"kind":"TREBLE","number":20},{"kind":"TREBLE","number":19},{"kind":"TREBLE","number":18},{"kind":"TREBLE","number":17}],"dartsPerTarget":9}'),
    ('SWITCHBLADE', 'SWITCHBLADE_V1', '{}'),
    ('DOUBLES_LOCK', 'DOUBLES_LOCK_V1', '{}'),
    ('HALVE_IT', 'HALVE_IT_V1', '{}');

INSERT INTO verification_results
SELECT '1',
    format('%s exercise type exists and is published', e.type_key),
    CASE WHEN count(et.id) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s published row(s)', count(et.id))
FROM expected e
    LEFT JOIN exercise_types et ON et.implementation_key = e.type_key AND et.is_published
GROUP BY e.type_key;

INSERT INTO verification_results
SELECT '2',
    format('%s is version 1 of %s', e.ruleset_key, e.type_key),
    CASE WHEN count(erv.id) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching row(s)', count(erv.id))
FROM expected e
    LEFT JOIN exercise_types et ON et.implementation_key = e.type_key
    LEFT JOIN exercise_ruleset_versions erv ON erv.exercise_type_id = et.id
        AND erv.implementation_key = e.ruleset_key
        AND erv.version_number = 1
GROUP BY e.type_key, e.ruleset_key;

INSERT INTO verification_results
SELECT '3',
    format('the system template pins %s with its default configuration', e.ruleset_key),
    CASE WHEN count(t.id) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching template(s)', count(t.id))
FROM expected e
    LEFT JOIN exercise_types et ON et.implementation_key = e.type_key
    LEFT JOIN exercise_ruleset_versions erv ON erv.implementation_key = e.ruleset_key
    LEFT JOIN exercise_templates t ON t.exercise_type_id = et.id
        AND t.exercise_ruleset_version_id = erv.id
        AND t.is_system_template
        AND t.game_type_id IS NULL
        AND t.default_configuration = e.configuration
GROUP BY e.ruleset_key;

INSERT INTO verification_results
SELECT '4',
    format('v_exercise_template_catalog offers %s', e.type_key),
    CASE WHEN count(c.exercise_type_key) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s catalog row(s)', count(c.exercise_type_key))
FROM expected e
    LEFT JOIN v_exercise_template_catalog c ON c.exercise_type_key = e.type_key
        AND c.has_default_configuration
GROUP BY e.type_key;

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY length(step), step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
