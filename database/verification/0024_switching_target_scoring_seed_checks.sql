-- ============================================================
-- Verification: 0024_switching_target_scoring_seed_checks.sql
--
-- Proves against a live database what seed
-- 0024_switching_target_scoring_exercise_type.sql can only claim locally:
-- the SWITCHING_TARGET_SCORING exercise type is published, its v1 ruleset
-- belongs to it, the system template pins that ruleset with the
-- rules document's default target sequence, and the template reaches
-- the routine builder through v_exercise_template_catalog.
--
-- Reads seeded rows only and ends in ROLLBACK, so it leaves
-- nothing behind and composes with the other verification
-- scripts.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0024_switching_target_scoring_seed_checks.sql
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
    'SWITCHING_TARGET_SCORING exercise type exists and is published',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s published row(s)', count(*))
FROM exercise_types
WHERE implementation_key = 'SWITCHING_TARGET_SCORING'
    AND is_published;

INSERT INTO verification_results
SELECT '2',
    'SWITCHING_TARGET_SCORING_V1 is version 1 of SWITCHING_TARGET_SCORING',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching row(s)', count(*))
FROM exercise_ruleset_versions erv
    JOIN exercise_types et ON et.id = erv.exercise_type_id
WHERE erv.implementation_key = 'SWITCHING_TARGET_SCORING_V1'
    AND erv.version_number = 1
    AND et.implementation_key = 'SWITCHING_TARGET_SCORING';

INSERT INTO verification_results
SELECT '3',
    'the system template pins SWITCHING_TARGET_SCORING_V1 with the default target sequence',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching template(s)', count(*))
FROM exercise_templates t
    JOIN exercise_types et ON et.id = t.exercise_type_id
    JOIN exercise_ruleset_versions erv ON erv.id = t.exercise_ruleset_version_id
WHERE et.implementation_key = 'SWITCHING_TARGET_SCORING'
    AND erv.implementation_key = 'SWITCHING_TARGET_SCORING_V1'
    AND t.is_system_template
    AND t.game_type_id IS NULL
    AND t.default_configuration = '{"targets":[20,19,18]}'::jsonb;

INSERT INTO verification_results
SELECT '4',
    'the template is offered by v_exercise_template_catalog',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s catalog row(s)', count(*))
FROM v_exercise_template_catalog
WHERE exercise_type_key = 'SWITCHING_TARGET_SCORING'
    AND has_default_configuration;

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY length(step), step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
