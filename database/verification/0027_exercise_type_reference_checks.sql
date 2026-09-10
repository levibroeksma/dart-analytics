-- ============================================================
-- Verification: 0027_exercise_type_reference_checks.sql
--
-- Proves against a live database what migration 0027 can only
-- claim locally (D193): the two reference tables exist with the
-- intended shape, their UNIQUE keys reject a duplicate
-- implementation_key, and the RESTRICT foreign key blocks
-- deleting an exercise type that a ruleset version still uses.
--
-- Builds its own fixture and ends in ROLLBACK, so it leaves
-- nothing behind and composes with the other verification
-- scripts.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0027_exercise_type_reference_checks.sql
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

INSERT INTO exercise_types (id, implementation_key, name, description, is_published, created_at, updated_at)
VALUES ('01999000-0000-7000-8000-0000000000f1', 'VERIFY_TYPE', 'Verify Type', 'Fixture.', FALSE, now(), now());

INSERT INTO exercise_ruleset_versions (id, exercise_type_id, implementation_key, version_number, description, created_at)
VALUES ('01999100-0000-7000-8000-0000000000f1', '01999000-0000-7000-8000-0000000000f1', 'VERIFY_TYPE_V1', 1, 'Fixture.', now());

INSERT INTO verification_results
SELECT '1',
    'fixture type and ruleset version inserted',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s ruleset version(s) for the fixture type', count(*))
FROM exercise_ruleset_versions
WHERE exercise_type_id = '01999000-0000-7000-8000-0000000000f1';

DO $$
BEGIN
    BEGIN
        INSERT INTO exercise_types (id, implementation_key, name, description, is_published, created_at, updated_at)
        VALUES ('01999000-0000-7000-8000-0000000000f2', 'VERIFY_TYPE', 'Duplicate', 'Fixture.', FALSE, now(), now());
        INSERT INTO verification_results VALUES ('2', 'duplicate implementation_key is rejected', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN unique_violation THEN
        INSERT INTO verification_results VALUES ('2', 'duplicate implementation_key is rejected', 'PASS', NULL);
    END;
END $$;

DO $$
BEGIN
    BEGIN
        DELETE FROM exercise_types WHERE id = '01999000-0000-7000-8000-0000000000f1';
        INSERT INTO verification_results VALUES ('3', 'RESTRICT blocks deleting a referenced exercise type', 'FAIL', 'delete succeeded');
    EXCEPTION WHEN foreign_key_violation THEN
        INSERT INTO verification_results VALUES ('3', 'RESTRICT blocks deleting a referenced exercise type', 'PASS', NULL);
    END;
END $$;

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
