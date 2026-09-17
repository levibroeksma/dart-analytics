-- ============================================================
-- Verification: 0035_exercise_template_ruleset_version_checks.sql
--
-- Proves against a live database what migration 0035 and seed
-- 0019 can only claim locally (D193): exercise_templates pins an
-- exercise ruleset version, the composite foreign key refuses a
-- version belonging to a different exercise type, and the three
-- non-game system templates were actually backfilled.
--
-- The cross-type check is the one that matters. A simple FK on
-- exercise_ruleset_version_id alone would accept a Switching
-- template pinned to WARM_UP_V1 — the join would then return a
-- row, the step would validate against the wrong ruleset, and
-- nothing would report it. Only the composite key makes that
-- combination unrepresentable.
--
-- Builds its own fixture and ends in ROLLBACK, so it leaves
-- nothing behind and composes with the other verification
-- scripts.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0035_exercise_template_ruleset_version_checks.sql
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
    'exercise_templates.exercise_ruleset_version_id exists and is nullable',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching column(s)', count(*))
FROM information_schema.columns
WHERE table_name = 'exercise_templates'
    AND column_name = 'exercise_ruleset_version_id'
    AND data_type = 'uuid'
    AND is_nullable = 'YES';

INSERT INTO verification_results
SELECT '2',
    'uq_exercise_ruleset_versions_type_id covers (exercise_type_id, id)',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 2 columns, found %s', count(*))
FROM information_schema.key_column_usage
WHERE constraint_name = 'uq_exercise_ruleset_versions_type_id'
    AND column_name IN ('exercise_type_id', 'id');

INSERT INTO verification_results
SELECT '3',
    'fk_exercise_templates_ruleset_version is composite over both columns',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 2 columns, found %s', count(*))
FROM information_schema.key_column_usage
WHERE constraint_name = 'fk_exercise_templates_ruleset_version'
    AND column_name IN ('exercise_type_id', 'exercise_ruleset_version_id');

INSERT INTO exercise_types (id, implementation_key, name, description, is_published, created_at, updated_at)
VALUES ('01999000-0000-7000-8000-0000000000e1', 'VERIFY_PIN_A', 'Verify Pin A', 'Fixture.', FALSE, now(), now()),
    ('01999000-0000-7000-8000-0000000000e2', 'VERIFY_PIN_B', 'Verify Pin B', 'Fixture.', FALSE, now(), now());

INSERT INTO exercise_ruleset_versions (id, exercise_type_id, implementation_key, version_number, description, created_at)
VALUES ('01999100-0000-7000-8000-0000000000e1', '01999000-0000-7000-8000-0000000000e1', 'VERIFY_PIN_A_V1', 1, 'Fixture.', now()),
    ('01999100-0000-7000-8000-0000000000e2', '01999000-0000-7000-8000-0000000000e1', 'VERIFY_PIN_A_V2', 2, 'Fixture.', now()),
    ('01999100-0000-7000-8000-0000000000e3', '01999000-0000-7000-8000-0000000000e2', 'VERIFY_PIN_B_V1', 1, 'Fixture.', now());

DO $$
BEGIN
    BEGIN
        INSERT INTO exercise_templates (id, exercise_type_id, exercise_ruleset_version_id, game_type_id, name, description, default_configuration, is_system_template, created_at, updated_at)
        VALUES ('01999200-0000-7000-8000-0000000000e1', '01999000-0000-7000-8000-0000000000e1', '01999100-0000-7000-8000-0000000000e3', NULL, 'Cross-type pin', 'Fixture.', NULL, FALSE, now(), now());
        INSERT INTO verification_results VALUES ('4', 'a ruleset version of another exercise type is rejected', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN foreign_key_violation THEN
        INSERT INTO verification_results VALUES ('4', 'a ruleset version of another exercise type is rejected', 'PASS', NULL);
    END;
END $$;

INSERT INTO exercise_templates (id, exercise_type_id, exercise_ruleset_version_id, game_type_id, name, description, default_configuration, is_system_template, created_at, updated_at)
VALUES ('01999200-0000-7000-8000-0000000000e2', '01999000-0000-7000-8000-0000000000e1', '01999100-0000-7000-8000-0000000000e2', NULL, 'Same-type pin', 'Fixture.', NULL, FALSE, now(), now());

INSERT INTO verification_results
SELECT '5',
    'a ruleset version of the template''s own exercise type is accepted',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s) pinned to VERIFY_PIN_A_V2', count(*))
FROM exercise_templates
WHERE id = '01999200-0000-7000-8000-0000000000e2'
    AND exercise_ruleset_version_id = '01999100-0000-7000-8000-0000000000e2';

INSERT INTO exercise_templates (id, exercise_type_id, exercise_ruleset_version_id, game_type_id, name, description, default_configuration, is_system_template, created_at, updated_at)
VALUES ('01999200-0000-7000-8000-0000000000e3', '01999000-0000-7000-8000-0000000000e1', NULL, NULL, 'Unpinned', 'Fixture.', NULL, FALSE, now(), now());

INSERT INTO verification_results
SELECT '6',
    'an unpinned template is accepted (MATCH SIMPLE skips the FK on NULL)',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s unpinned fixture row(s)', count(*))
FROM exercise_templates
WHERE id = '01999200-0000-7000-8000-0000000000e3'
    AND exercise_ruleset_version_id IS NULL;

DO $$
BEGIN
    BEGIN
        DELETE FROM exercise_ruleset_versions WHERE id = '01999100-0000-7000-8000-0000000000e2';
        INSERT INTO verification_results VALUES ('7', 'RESTRICT blocks deleting a pinned ruleset version', 'FAIL', 'delete succeeded');
    EXCEPTION WHEN foreign_key_violation THEN
        INSERT INTO verification_results VALUES ('7', 'RESTRICT blocks deleting a pinned ruleset version', 'PASS', NULL);
    END;
END $$;

INSERT INTO verification_results
SELECT '8',
    'seed 0019 pinned every non-game system template',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('%s system template(s) left unpinned', count(*))
FROM exercise_templates t
    JOIN exercise_types et ON et.id = t.exercise_type_id
WHERE t.is_system_template = TRUE
    AND et.implementation_key <> 'GAME'
    AND t.exercise_ruleset_version_id IS NULL;

INSERT INTO verification_results
SELECT '9',
    'the three seeded non-game templates pin their own v1 ruleset',
    CASE WHEN count(*) = 3 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 3, found %s', count(*))
FROM exercise_templates t
    JOIN exercise_types et ON et.id = t.exercise_type_id
    JOIN exercise_ruleset_versions erv ON erv.id = t.exercise_ruleset_version_id
WHERE (et.implementation_key, erv.implementation_key) IN (
        ('WARM_UP', 'WARM_UP_V1'),
        ('SWITCHING', 'SWITCHING_V1'),
        ('DOUBLE_PATTERN', 'DOUBLE_PATTERN_V1')
    );

INSERT INTO verification_results
SELECT '10',
    'a GAME system template stays unpinned',
    CASE WHEN count(*) FILTER (WHERE t.exercise_ruleset_version_id IS NOT NULL) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('%s of %s GAME system template(s) carry an exercise ruleset', count(*) FILTER (WHERE t.exercise_ruleset_version_id IS NOT NULL), count(*))
FROM exercise_templates t
    JOIN exercise_types et ON et.id = t.exercise_type_id
WHERE t.is_system_template = TRUE
    AND et.implementation_key = 'GAME';

INSERT INTO verification_results
SELECT '11',
    'anti-vacuity: the seeded system templates this script asserts on exist',
    CASE WHEN count(*) >= 4 THEN 'PASS' ELSE 'FAIL' END,
    format('expected at least 4 system templates, found %s', count(*))
FROM exercise_templates
WHERE is_system_template = TRUE;

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY length(step), step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
