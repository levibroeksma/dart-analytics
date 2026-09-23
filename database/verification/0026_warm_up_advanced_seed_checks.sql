-- ============================================================
-- Verification: 0026_warm_up_advanced_seed_checks.sql
--
-- Proves against a live database what seed
-- 0026_warm_up_advanced_template.sql can only claim locally:
-- the "Warm-Up Advanced" system template is a WARM_UP template
-- pinned to WARM_UP_V1, its sections aim at one number each
-- (20, 3, 6, 11) then the bull, and the routine builder's
-- catalog offers it beside the original Warm-Up.
--
-- Reads seeded rows only and ends in ROLLBACK, so it leaves
-- nothing behind and composes with the other verification
-- scripts.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0026_warm_up_advanced_seed_checks.sql
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
    'Warm-Up Advanced is a WARM_UP system template pinned to WARM_UP_V1',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching template(s)', count(*))
FROM exercise_templates t
    JOIN exercise_types et ON et.id = t.exercise_type_id
    JOIN exercise_ruleset_versions erv ON erv.id = t.exercise_ruleset_version_id
WHERE t.id = '0199b000-0000-7000-8000-00000000000a'
    AND t.name = 'Warm-Up Advanced'
    AND et.implementation_key = 'WARM_UP'
    AND erv.implementation_key = 'WARM_UP_V1'
    AND t.is_system_template
    AND t.game_type_id IS NULL;

INSERT INTO verification_results
SELECT '2',
    'its sections aim at 20, 3, 6, 11, then the bull, weight 1 each',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching template(s)', count(*))
FROM exercise_templates
WHERE id = '0199b000-0000-7000-8000-00000000000a'
    AND default_configuration = '{"phases":[
        {"name":"Upper","targets":[20],"weight":1},
        {"name":"Lower","targets":[3],"weight":1},
        {"name":"Right","targets":[6],"weight":1},
        {"name":"Left","targets":[11],"weight":1},
        {"name":"Bull","targets":[25],"weight":1}
    ]}'::jsonb;

INSERT INTO verification_results
SELECT '3',
    'the catalog offers both WARM_UP templates',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END,
    format('%s catalog row(s)', count(*))
FROM v_exercise_template_catalog
WHERE exercise_type_key = 'WARM_UP'
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
