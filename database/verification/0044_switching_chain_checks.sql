-- ============================================================
-- Verification: 0044_switching_chain_checks.sql
--
-- Proves against a live database what seed
-- 0044_switching_chain.sql can only claim locally: the existing
-- SWITCHING exercise type now owns two ruleset versions, the
-- "Chain" system template pins SWITCHING_CHAIN_V1 with the
-- three-target configuration, both Switching templates reach
-- the routine builder through v_exercise_template_catalog with
-- the right difficulty levels, and — the check that matters
-- most — the pre-existing Standard template still holds the
-- configuration and the SWITCHING_V1 pin it was seeded with.
--
-- That last one is not cosmetic: v_stats_routine_step_facts
-- (migration 0045) fingerprints a routine step by its stored
-- configuration and ruleset version key, so a drifted
-- configuration or pin would restart every player's Balanced
-- Training trend. The template's name and description are not
-- in that fingerprint — seed 0046 renames the row to "Standard"
-- and redescribes it on purpose, and checks 4 and 6 assert the
-- post-0046 values.
--
-- Reads seeded rows only and ends in ROLLBACK, so it leaves
-- nothing behind and composes with the other verification
-- scripts.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0044_switching_chain_checks.sql
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
    'SWITCHING_CHAIN_V1 is a ruleset of the existing SWITCHING type',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching row(s)', count(*))
FROM exercise_ruleset_versions erv
    JOIN exercise_types et ON et.id = erv.exercise_type_id
WHERE erv.implementation_key = 'SWITCHING_CHAIN_V1'
    AND et.implementation_key = 'SWITCHING'
    AND et.id = '0199a000-0000-7000-8000-000000000003';

INSERT INTO verification_results
SELECT '2',
    'SWITCHING owns exactly two ruleset versions, V1 and CHAIN_V1',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END,
    format('%s version(s): %s', count(*), string_agg(erv.implementation_key, ', ' ORDER BY erv.implementation_key))
FROM exercise_ruleset_versions erv
    JOIN exercise_types et ON et.id = erv.exercise_type_id
WHERE et.implementation_key = 'SWITCHING';

INSERT INTO verification_results
SELECT '3',
    'the Chain system template pins SWITCHING_CHAIN_V1 with the three-target configuration',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching template(s)', count(*))
FROM exercise_templates t
    JOIN exercise_types et ON et.id = t.exercise_type_id
    JOIN exercise_ruleset_versions erv ON erv.id = t.exercise_ruleset_version_id
WHERE et.implementation_key = 'SWITCHING'
    AND erv.implementation_key = 'SWITCHING_CHAIN_V1'
    AND t.name = 'Chain'
    AND t.is_system_template
    AND t.game_type_id IS NULL
    AND t.default_configuration = '{"targets":[20,19,18]}'::jsonb;

INSERT INTO verification_results
SELECT '4',
    'the Standard template reads Standard, with its seeded configuration and SWITCHING_V1 pin',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching template(s)', count(*))
FROM exercise_templates t
    JOIN exercise_ruleset_versions erv ON erv.id = t.exercise_ruleset_version_id
WHERE t.id = '0199b000-0000-7000-8000-000000000002'
    AND t.exercise_type_id = '0199a000-0000-7000-8000-000000000003'
    AND erv.implementation_key = 'SWITCHING_V1'
    AND t.name = 'Standard'
    AND t.description = 'One dart at each target in turn, every dart scored by the ring it hits: single 1, double 2, treble 3.'
    AND t.game_type_id IS NULL
    AND t.default_configuration = '{"targets":[20,19,18],"scoring":{"single":1,"double":2,"treble":3}}'::jsonb;

INSERT INTO verification_results
SELECT '5',
    'v_exercise_template_catalog offers both Switching templates with defaults',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END,
    format('%s catalog row(s): %s', count(*), string_agg(name, ', ' ORDER BY name))
FROM v_exercise_template_catalog
WHERE exercise_type_key = 'SWITCHING'
    AND has_default_configuration;

INSERT INTO verification_results
SELECT '6',
    'the catalog levels Standard 1 (Beginner) and Chain 2 (Intermediate)',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching row(s)', count(*))
FROM v_exercise_template_catalog
WHERE exercise_type_key = 'SWITCHING'
    AND ((name = 'Standard' AND difficulty_level = 1)
      OR (name = 'Chain' AND difficulty_level = 2));

INSERT INTO verification_results
SELECT '7',
    'both difficulties come from the templates own difficulty_tag_id, not a type fallback',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END,
    format('%s pinned template(s)', count(*))
FROM exercise_templates t
    JOIN exercise_types et ON et.id = t.exercise_type_id
    JOIN tags tg ON tg.id = t.difficulty_tag_id
    JOIN tag_axes a ON a.id = tg.tag_axis_id
WHERE et.implementation_key = 'SWITCHING'
    AND a.implementation_key = 'DIFFICULTY'
    AND ((t.id = '0199b000-0000-7000-8000-000000000002' AND tg.implementation_key = 'BEGINNER')
      OR (t.id = '0199b000-0000-7000-8000-000000000015' AND tg.implementation_key = 'INTERMEDIATE'));

-- Anti-vacuity: every check above counts rows, so a dropped view or an empty
-- table would make some of them pass by accident only if the expected count
-- were zero. None is, and this row asserts the fixture the whole script reads.
INSERT INTO verification_results
SELECT '8',
    'anti-vacuity: the SWITCHING exercise type exists and is published',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s published row(s)', count(*))
FROM exercise_types
WHERE implementation_key = 'SWITCHING'
    AND is_published;

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY length(step), step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
