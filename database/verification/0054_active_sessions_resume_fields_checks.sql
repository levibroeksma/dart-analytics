-- ============================================================
-- Verification: 0054_active_sessions_resume_fields_checks.sql
--
-- Runs assertions against a live database for
-- migrations/0054_active_sessions_resume_fields.sql (D193):
--
--   1. A routine-step session (routine_step_sequence_number set,
--      no configuration row) reads is_routine_step = true and a
--      NULL configuration.
--   2. A standalone game session with a configuration snapshot
--      reads is_routine_step = false and that exact snapshot.
--   3. The widening adds columns, never rows: the fixture player
--      returns exactly one row per active session.
--
-- Everything runs inside one transaction that ends in ROLLBACK,
-- so no fixture row survives. Lookup rows are resolved by
-- implementation_key, never by hardcoded id.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0054_active_sessions_resume_fields_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0054.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Fixture: one player with two ACTIVE sessions. The warm-up is a
-- routine step with no configuration row; the 501 game is
-- standalone and carries a configuration snapshot.
-- ------------------------------------------------------------
INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES (
        '01990000-0000-7000-8000-000000005401',
        'verification-0054-owner',
        'Verification Owner',
        now(),
        now()
    );

INSERT INTO activities (id, player_id, status_id, started_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000005402',
        '01990000-0000-7000-8000-000000005401',
        (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
        now(),
        now()
    );

INSERT INTO exercise_sessions (
        id,
        activity_id,
        player_id,
        exercise_type_id,
        exercise_ruleset_version_id,
        routine_step_sequence_number,
        status_id,
        started_at,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000005403',
        '01990000-0000-7000-8000-000000005402',
        '01990000-0000-7000-8000-000000005401',
        (SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'),
        (SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'WARM_UP_V1'),
        1,
        (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
        now(),
        now()
    );

INSERT INTO exercise_sessions (
        id,
        activity_id,
        player_id,
        exercise_type_id,
        game_type_id,
        capture_mode_id,
        input_mode_id,
        status_id,
        ruleset_version_id,
        started_at,
        created_at
    )
SELECT '01990000-0000-7000-8000-000000005404',
    '01990000-0000-7000-8000-000000005402',
    '01990000-0000-7000-8000-000000005401',
    (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'),
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
    (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
    rv.id,
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = '501_V1';

INSERT INTO exercise_configurations (id, exercise_session_id, configuration, created_at)
VALUES (
        '01990000-0000-7000-8000-000000005405',
        '01990000-0000-7000-8000-000000005404',
        '{"startScore": 501}'::jsonb,
        now()
    );

-- ------------------------------------------------------------
-- Step 1: routine step reads true, no configuration.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'Routine-step session reads is_routine_step = true and NULL configuration',
    CASE
        WHEN count(*) = 1
            AND bool_and(is_routine_step)
            AND bool_and(configuration IS NULL)
        THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s row(s); is_routine_step=%s', count(*), bool_and(is_routine_step))
FROM v_active_sessions
WHERE session_id = '01990000-0000-7000-8000-000000005403';

-- ------------------------------------------------------------
-- Step 2: standalone game reads false, the exact snapshot.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'Standalone game session reads is_routine_step = false and its configuration',
    CASE
        WHEN count(*) = 1
            AND NOT bool_or(is_routine_step)
            AND bool_and(configuration = '{"startScore": 501}'::jsonb)
        THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s row(s); is_routine_step=%s; configuration=%s', count(*), bool_or(is_routine_step), max(configuration::text))
FROM v_active_sessions
WHERE session_id = '01990000-0000-7000-8000-000000005404';

-- ------------------------------------------------------------
-- Step 3: one row per active session -- no fan-out.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    'Fixture player returns 2 rows (one per active session)',
    CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s)', count(*))
FROM v_active_sessions
WHERE player_id = '01990000-0000-7000-8000-000000005401';

-- ------------------------------------------------------------
-- Anti-vacuity guard (D192).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4',
    'all 3 view-driven checks actually ran',
    CASE WHEN count(*) = 3 THEN 'PASS' ELSE 'FAIL' END,
    format('%s of 3 checks ran', count(*))
FROM verification_results
WHERE step IN ('1', '2', '3');

-- ------------------------------------------------------------
-- Results
-- ------------------------------------------------------------
SELECT step,
    result,
    check_name,
    detail
FROM verification_results
ORDER BY step,
    check_name;

SELECT CASE
        WHEN count(*) FILTER (
            WHERE result = 'FAIL'
        ) = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format(
            '%s OF %s CHECKS FAILED',
            count(*) FILTER (
                WHERE result = 'FAIL'
            ),
            count(*)
        )
    END AS summary
FROM verification_results;

ROLLBACK;
