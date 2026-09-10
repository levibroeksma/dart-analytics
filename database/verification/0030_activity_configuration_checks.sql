-- ============================================================
-- Verification: 0030_activity_configuration_checks.sql
--
-- Proves against a live database (D193) that the training
-- configuration snapshot is one-per-activity and dies with its
-- activity.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0030_activity_configuration_checks.sql
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

INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES ('01999200-0000-7000-8000-0000000000f2', 'verify-0030-01999200-0000-7000-8000-0000000000f2', 'Verify Player', now(), now());

INSERT INTO activities (id, player_id, status_id, started_at, created_at)
SELECT '01999300-0000-7000-8000-0000000000f2',
    '01999200-0000-7000-8000-0000000000f2',
    (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
    now(), now();

INSERT INTO activity_configurations (id, activity_id, configuration, created_at)
VALUES ('01999500-0000-7000-8000-0000000000f1',
    '01999300-0000-7000-8000-0000000000f2',
    '{"routineName":"Warm-Up","steps":[]}'::jsonb,
    now());

INSERT INTO verification_results
SELECT '1',
    'snapshot inserted and readable as JSONB',
    CASE WHEN configuration ->> 'routineName' = 'Warm-Up' THEN 'PASS' ELSE 'FAIL' END,
    format('routineName read back as %s', configuration ->> 'routineName')
FROM activity_configurations
WHERE id = '01999500-0000-7000-8000-0000000000f1';

DO $$
BEGIN
    BEGIN
        INSERT INTO activity_configurations (id, activity_id, configuration, created_at)
        VALUES ('01999500-0000-7000-8000-0000000000f2',
            '01999300-0000-7000-8000-0000000000f2',
            '{}'::jsonb, now());
        INSERT INTO verification_results VALUES ('2', 'second snapshot for one activity is rejected', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN unique_violation THEN
        INSERT INTO verification_results VALUES ('2', 'second snapshot for one activity is rejected', 'PASS', NULL);
    END;
END $$;

DELETE FROM activities WHERE id = '01999300-0000-7000-8000-0000000000f2';

INSERT INTO verification_results
SELECT '3',
    'deleting the activity cascades to its snapshot',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('%s snapshot row(s) survived', count(*))
FROM activity_configurations
WHERE activity_id = '01999300-0000-7000-8000-0000000000f2';

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
