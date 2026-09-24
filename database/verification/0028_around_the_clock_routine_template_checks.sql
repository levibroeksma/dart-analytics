-- ============================================================
-- Verification: 0028_around_the_clock_routine_template_checks.sql
--
-- Asserts seed 0028's three Around the Clock routine templates:
--
--   1. all three rows exist as system GAME templates
--   2. each pins AROUND_THE_CLOCK_V2 under the AROUND_THE_CLOCK game
--   3. each default_configuration carries exactly the six V2 keys
--   4. v_exercise_template_catalog offers all three with defaults
--
-- No PostgreSQL server exists in the container that authored this
-- file (D193), so it asserts against a real Neon database before
-- merge.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0028_around_the_clock_routine_template_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:seed` has applied seeds/0027 and seeds/0028.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

INSERT INTO verification_results
SELECT '1', 'three system GAME templates exist',
    CASE WHEN count(*) = 3 THEN 'PASS' ELSE 'FAIL' END,
    format('%s of 3 found', count(*))
FROM exercise_templates et
    JOIN exercise_types xt ON xt.id = et.exercise_type_id
WHERE et.id IN ('0199b000-0000-7000-8000-00000000000b',
                '0199b000-0000-7000-8000-00000000000c',
                '0199b000-0000-7000-8000-00000000000d')
    AND xt.implementation_key = 'GAME'
    AND et.is_system_template;

INSERT INTO verification_results
SELECT '2', 'each pins AROUND_THE_CLOCK_V2 under AROUND_THE_CLOCK',
    CASE WHEN count(*) = 3 THEN 'PASS' ELSE 'FAIL' END,
    format('%s of 3 pinned', count(*))
FROM exercise_templates et
    JOIN game_types gt ON gt.id = et.game_type_id
    JOIN ruleset_versions rv ON rv.id = et.game_ruleset_version_id
WHERE et.id IN ('0199b000-0000-7000-8000-00000000000b',
                '0199b000-0000-7000-8000-00000000000c',
                '0199b000-0000-7000-8000-00000000000d')
    AND gt.implementation_key = 'AROUND_THE_CLOCK'
    AND rv.implementation_key = 'AROUND_THE_CLOCK_V2';

INSERT INTO verification_results
SELECT '3', 'each default_configuration holds exactly the six V2 keys',
    CASE WHEN count(*) = 3 THEN 'PASS' ELSE 'FAIL' END,
    format('%s of 3 well-formed', count(*))
FROM exercise_templates et
WHERE et.id IN ('0199b000-0000-7000-8000-00000000000b',
                '0199b000-0000-7000-8000-00000000000c',
                '0199b000-0000-7000-8000-00000000000d')
    AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(et.default_configuration) k)
        = ARRAY['difficulty', 'duration_type', 'duration_value', 'odds_first', 'path_direction', 'segment_rule'];

INSERT INTO verification_results
SELECT '4', 'v_exercise_template_catalog offers all three with defaults',
    CASE WHEN count(*) = 3 THEN 'PASS' ELSE 'FAIL' END,
    format('%s of 3 offered', count(*))
FROM v_exercise_template_catalog
WHERE game_ruleset_version_key = 'AROUND_THE_CLOCK_V2'
    AND has_default_configuration;

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
