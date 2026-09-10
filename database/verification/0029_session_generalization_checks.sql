-- ============================================================
-- Verification: 0029_session_generalization_checks.sql
--
-- Proves against a live database (D193) that:
--   1. a warm-up-shaped session row (no game type, no ruleset
--      version, no capture or input mode) is accepted, and that
--      migration 0020's MATCH SIMPLE composite capability
--      foreign key does not block it
--   2. chk_exercise_sessions_game_pair rejects a half-set game
--      pair
--   3. chk_exercise_sessions_capture_pair rejects a half-set
--      capture pair
--   4. a capture pair without a game pair is accepted, which is
--      the shape a future dart-driven non-game exercise needs
--
-- Builds its own player, activity and session fixture, resolves
-- lookups by implementation_key, and ends in ROLLBACK.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0029_session_generalization_checks.sql
--
-- Expected: every result row reads PASS. Run after
-- `npm run db:seed` has applied seeds/0014.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE fixture AS
SELECT '01999200-0000-7000-8000-0000000000f1'::uuid AS player_id,
    '01999300-0000-7000-8000-0000000000f1'::uuid AS activity_id,
    (SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP') AS warm_up_type_id,
    (SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'WARM_UP_V1') AS warm_up_ruleset_id,
    (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE') AS active_status_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS') AS analytics_id,
    (SELECT id FROM input_modes WHERE implementation_key = 'DETAILED_DARTS') AS detailed_id;

INSERT INTO verification_results
SELECT '0',
    'every fixture lookup resolved',
    CASE WHEN warm_up_type_id IS NOT NULL
              AND warm_up_ruleset_id IS NOT NULL
              AND active_status_id IS NOT NULL
              AND analytics_id IS NOT NULL
              AND detailed_id IS NOT NULL
         THEN 'PASS' ELSE 'FAIL' END,
    'a NULL here means seeds/0014 has not been applied'
FROM fixture;

INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
SELECT player_id, 'verify-0029-' || player_id::text, 'Verify Player', now(), now() FROM fixture;

INSERT INTO activities (id, player_id, status_id, started_at, created_at)
SELECT activity_id, player_id, active_status_id, now(), now() FROM fixture;

DO $$
DECLARE f RECORD;
BEGIN
    SELECT * INTO f FROM fixture;
    BEGIN
        INSERT INTO exercise_sessions (
            id, activity_id, player_id, exercise_type_id, exercise_ruleset_version_id,
            routine_step_sequence_number, status_id, started_at, created_at
        )
        VALUES (
            '01999400-0000-7000-8000-0000000000f1', f.activity_id, f.player_id, f.warm_up_type_id,
            f.warm_up_ruleset_id, 1, f.active_status_id, now(), now()
        );
        INSERT INTO verification_results VALUES ('1', 'warm-up shaped session is accepted', 'PASS', NULL);
    EXCEPTION WHEN others THEN
        INSERT INTO verification_results VALUES ('1', 'warm-up shaped session is accepted', 'FAIL', SQLERRM);
    END;
END $$;

DO $$
DECLARE f RECORD;
BEGIN
    SELECT * INTO f FROM fixture;
    BEGIN
        INSERT INTO exercise_sessions (
            id, activity_id, player_id, exercise_type_id, game_type_id,
            status_id, started_at, created_at
        )
        VALUES (
            '01999400-0000-7000-8000-0000000000f2', f.activity_id, f.player_id, f.warm_up_type_id,
            (SELECT id FROM game_types WHERE implementation_key = '501'),
            f.active_status_id, now(), now()
        );
        INSERT INTO verification_results VALUES ('2', 'half-set game pair is rejected', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('2', 'half-set game pair is rejected', 'PASS', NULL);
    END;
END $$;

DO $$
DECLARE f RECORD;
BEGIN
    SELECT * INTO f FROM fixture;
    BEGIN
        INSERT INTO exercise_sessions (
            id, activity_id, player_id, exercise_type_id, capture_mode_id,
            status_id, started_at, created_at
        )
        VALUES (
            '01999400-0000-7000-8000-0000000000f3', f.activity_id, f.player_id, f.warm_up_type_id,
            f.analytics_id, f.active_status_id, now(), now()
        );
        INSERT INTO verification_results VALUES ('3', 'half-set capture pair is rejected', 'FAIL', 'insert succeeded');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES ('3', 'half-set capture pair is rejected', 'PASS', NULL);
    END;
END $$;

DO $$
DECLARE f RECORD;
BEGIN
    SELECT * INTO f FROM fixture;
    BEGIN
        INSERT INTO exercise_sessions (
            id, activity_id, player_id, exercise_type_id, exercise_ruleset_version_id,
            capture_mode_id, input_mode_id, status_id, started_at, created_at
        )
        VALUES (
            '01999400-0000-7000-8000-0000000000f4', f.activity_id, f.player_id, f.warm_up_type_id,
            f.warm_up_ruleset_id, f.analytics_id, f.detailed_id, f.active_status_id, now(), now()
        );
        INSERT INTO verification_results VALUES ('4', 'capture pair without a game pair is accepted', 'PASS', NULL);
    EXCEPTION WHEN others THEN
        INSERT INTO verification_results VALUES ('4', 'capture pair without a game pair is accepted', 'FAIL', SQLERRM);
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
