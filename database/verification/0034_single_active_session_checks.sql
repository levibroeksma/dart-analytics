-- ============================================================
-- Verification: 0034_single_active_session_checks.sql
--
-- Proves against a live database (D193) that migration 0034's
-- uq_sessions_single_active constrains non-game sessions --
-- the case the 0011 index could never reach, because its
-- game_type_id is NULL and Postgres treats NULLs as distinct
-- (issue #310).
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0034_single_active_session_checks.sql
--
-- Expected: every result row reads PASS. Run after
-- `npm run db:seed`.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES ('01999200-0000-7000-8000-0000000000f4', 'verify-0034-01999200-0000-7000-8000-0000000000f4', 'Verify Player', now(), now());

INSERT INTO activities (id, player_id, status_id, started_at, created_at)
SELECT '01999300-0000-7000-8000-0000000000f4',
    '01999200-0000-7000-8000-0000000000f4',
    (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
    now(), now();

INSERT INTO exercise_sessions (id, activity_id, player_id, exercise_type_id, status_id, started_at, created_at)
SELECT '01999400-0000-7000-8000-0000000000f1',
    '01999300-0000-7000-8000-0000000000f4',
    '01999200-0000-7000-8000-0000000000f4',
    (SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
    now(), now();

INSERT INTO verification_results
SELECT '1',
    'first open SWITCHING session inserts',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s) present', count(*))
FROM exercise_sessions
WHERE id = '01999400-0000-7000-8000-0000000000f1';

DO $$
BEGIN
    BEGIN
        INSERT INTO exercise_sessions (id, activity_id, player_id, exercise_type_id, status_id, started_at, created_at)
        SELECT '01999400-0000-7000-8000-0000000000f2',
            '01999300-0000-7000-8000-0000000000f4',
            '01999200-0000-7000-8000-0000000000f4',
            (SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING'),
            (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
            now(), now();
        INSERT INTO verification_results VALUES ('2', 'second open SWITCHING session for the same player is rejected', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN unique_violation THEN
        INSERT INTO verification_results VALUES ('2', 'second open SWITCHING session for the same player is rejected', 'PASS', NULL);
    END;
END $$;

DO $$
BEGIN
    BEGIN
        INSERT INTO exercise_sessions (id, activity_id, player_id, exercise_type_id, status_id, started_at, created_at)
        SELECT '01999400-0000-7000-8000-0000000000f3',
            '01999300-0000-7000-8000-0000000000f4',
            '01999200-0000-7000-8000-0000000000f4',
            (SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'),
            (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
            now(), now();
        INSERT INTO verification_results VALUES ('3', 'a different exercise type stays startable', 'PASS', NULL);
    EXCEPTION WHEN unique_violation THEN
        INSERT INTO verification_results VALUES ('3', 'a different exercise type stays startable', 'FAIL', 'insert rejected');
    END;
END $$;

UPDATE exercise_sessions
SET status_id = (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
    completed_at = now()
WHERE id = '01999400-0000-7000-8000-0000000000f1';

DO $$
BEGIN
    BEGIN
        INSERT INTO exercise_sessions (id, activity_id, player_id, exercise_type_id, status_id, started_at, created_at)
        SELECT '01999400-0000-7000-8000-0000000000f4',
            '01999300-0000-7000-8000-0000000000f4',
            '01999200-0000-7000-8000-0000000000f4',
            (SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING'),
            (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
            now(), now();
        INSERT INTO verification_results VALUES ('4', 'closing the first session frees the key', 'PASS', NULL);
    EXCEPTION WHEN unique_violation THEN
        INSERT INTO verification_results VALUES ('4', 'closing the first session frees the key', 'FAIL', 'insert rejected');
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
