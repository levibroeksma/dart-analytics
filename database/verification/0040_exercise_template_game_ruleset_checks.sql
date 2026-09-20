-- ============================================================
-- Verification: 0040_exercise_template_game_ruleset_checks.sql
--
-- Proves against a live database what migration 0040 and seed
-- 0021 can only claim locally (D193): exercise_templates pins a
-- game ruleset version through a composite foreign key that
-- refuses a ruleset version belonging to a different game, the
-- pair CHECK rejects a half-paired new row even though it is
-- NOT VALID, seed 0021 backfilled Finishing to TUOD_V1, both
-- routine views expose game_ruleset_version_key, and seed 0022's
-- two new templates are present and valid pairs.
--
-- Check 8 asserts on seed 0022 (Score Training (timed), 121
-- (timed)), which is a later task in this plan -- it FAILs until
-- that seed lands.
--
-- Builds its own fixture and ends in ROLLBACK, so it leaves
-- nothing behind and composes with the other verification
-- scripts.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0040_exercise_template_game_ruleset_checks.sql
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

-- 1 column exists, nullable uuid
INSERT INTO verification_results
SELECT '1', 'exercise_templates.game_ruleset_version_id exists and is nullable',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END, format('%s column(s)', count(*))
FROM information_schema.columns
WHERE table_name = 'exercise_templates' AND column_name = 'game_ruleset_version_id'
    AND data_type = 'uuid' AND is_nullable = 'YES';

-- 2 composite FK over both columns
INSERT INTO verification_results
SELECT '2', 'fk_exercise_templates_game_ruleset_version is composite (game_type_id, game_ruleset_version_id)',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END, format('%s of 2 columns', count(*))
FROM information_schema.key_column_usage
WHERE constraint_name = 'fk_exercise_templates_game_ruleset_version'
    AND column_name IN ('game_type_id', 'game_ruleset_version_id');

-- 3 cross-game pin rejected: TUOD template pinned to SCORE_TRAINING_V1
DO $$
BEGIN
    BEGIN
        INSERT INTO exercise_templates (id, exercise_type_id, exercise_ruleset_version_id, game_type_id, game_ruleset_version_id, name, description, default_configuration, is_system_template, created_at, updated_at)
        VALUES ('01999500-0000-7000-8000-0000000000a1',
                (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'), NULL,
                (SELECT id FROM game_types WHERE implementation_key = 'TUOD'),
                (SELECT id FROM ruleset_versions WHERE implementation_key = 'SCORE_TRAINING_V1'),
                'Cross-game pin', 'Fixture.', '{}'::jsonb, FALSE, now(), now());
        INSERT INTO verification_results VALUES ('3', 'a ruleset version of another game is rejected', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN foreign_key_violation THEN
        INSERT INTO verification_results VALUES ('3', 'a ruleset version of another game is rejected', 'PASS', NULL);
    END;
END $$;

-- 4 half-pair rejected by the CHECK on a NEW row (NOT VALID still checks inserts)
DO $$
BEGIN
    BEGIN
        INSERT INTO exercise_templates (id, exercise_type_id, exercise_ruleset_version_id, game_type_id, game_ruleset_version_id, name, description, default_configuration, is_system_template, created_at, updated_at)
        VALUES ('01999500-0000-7000-8000-0000000000a2',
                (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'), NULL,
                (SELECT id FROM game_types WHERE implementation_key = 'TUOD'), NULL,
                'Half pair', 'Fixture.', '{}'::jsonb, FALSE, now(), now());
        INSERT INTO verification_results VALUES ('4', 'a game template with no game ruleset version is rejected', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('4', 'a game template with no game ruleset version is rejected', 'PASS', NULL);
    END;
END $$;

-- 5 seed 0021 backfilled Finishing
INSERT INTO verification_results
SELECT '5', 'seed 0021 pinned Finishing to TUOD_V1',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END, format('%s row(s)', count(*))
FROM exercise_templates et JOIN ruleset_versions rv ON rv.id = et.game_ruleset_version_id
WHERE et.id = '0199b000-0000-7000-8000-000000000004' AND rv.implementation_key = 'TUOD_V1';

-- 6 every system GAME template carries a pin (what VALIDATE CONSTRAINT will later prove)
INSERT INTO verification_results
SELECT '6', 'no system GAME template is left half-paired',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END, format('%s half-paired row(s)', count(*))
FROM exercise_templates
WHERE is_system_template AND (game_type_id IS NULL) <> (game_ruleset_version_id IS NULL);

-- 7 views expose game_ruleset_version_key
INSERT INTO verification_results
SELECT '7', 'both routine views expose game_ruleset_version_key',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END, format('%s of 2 views', count(*))
FROM information_schema.columns
WHERE table_name IN ('v_routine_execution', 'v_exercise_template_catalog') AND column_name = 'game_ruleset_version_key';

-- 8 seed 0022 templates present and valid pairs
INSERT INTO verification_results
SELECT '8', 'seed 0022 added Score Training (timed) and 121 (timed) pinned to their rulesets',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END, format('%s row(s)', count(*))
FROM v_exercise_template_catalog
WHERE (name, game_ruleset_version_key) IN (('Score Training (timed)', 'SCORE_TRAINING_V1'), ('121 (timed)', '121_V2'))
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
