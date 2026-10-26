-- ============================================================
-- Verification: 0051_active_sessions_routine_config_checks.sql
--
-- Runs assertions against a live database for
-- migrations/0051_active_sessions_routine_config.sql (D193):
--
--   1. A routine-step session reads is_routine_step = true and its
--      configuration snapshot from v_active_sessions.
--   2. A standalone session with no snapshot reads
--      is_routine_step = false and a NULL configuration.
--   3. Each session appears exactly once (the configuration join
--      multiplies no row).
--
-- Everything runs inside one transaction that ends in ROLLBACK,
-- so no fixture row survives. Lookup rows are resolved by
-- implementation_key, never by hardcoded id.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0051_active_sessions_routine_config_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0051.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES (
        '01990000-0000-7000-8000-000000005101',
        'verification-0051-owner',
        'Verification Owner',
        now(),
        now()
    );

INSERT INTO activities (id, player_id, status_id, started_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000005102',
        '01990000-0000-7000-8000-000000005101',
        (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
        now(),
        now()
    ),
    (
        '01990000-0000-7000-8000-000000005112',
        '01990000-0000-7000-8000-000000005101',
        (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
        now(),
        now()
    );

-- Session ...5103 is step 2 of a routine; ...5113 is standalone.
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
        routine_step_sequence_number,
        started_at,
        created_at
    )
SELECT s.session_id::uuid,
    s.activity_id::uuid,
    '01990000-0000-7000-8000-000000005101',
    (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'),
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
    (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
    rv.id,
    s.step,
    now(),
    now()
FROM ruleset_versions rv
    CROSS JOIN (
        VALUES (
                '01990000-0000-7000-8000-000000005103',
                '01990000-0000-7000-8000-000000005102',
                2
            ),
            (
                '01990000-0000-7000-8000-000000005113',
                '01990000-0000-7000-8000-000000005112',
                NULL
            )
    ) AS s(session_id, activity_id, step)
WHERE rv.implementation_key = '501_V1';

INSERT INTO exercise_configurations (id, exercise_session_id, configuration, created_at)
VALUES (
        '01990000-0000-7000-8000-000000005104',
        '01990000-0000-7000-8000-000000005103',
        '{"marker": "verification-0051"}'::jsonb,
        now()
    );

INSERT INTO verification_results
SELECT '1',
    'routine step reads is_routine_step and its configuration',
    CASE
        WHEN count(*) = 1
        AND bool_and(is_routine_step)
        AND bool_and(configuration ->> 'marker' = 'verification-0051') THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s rows', count(*))
FROM v_active_sessions
WHERE session_id = '01990000-0000-7000-8000-000000005103';

INSERT INTO verification_results
SELECT '2',
    'standalone session reads is_routine_step false and NULL configuration',
    CASE
        WHEN count(*) = 1
        AND bool_and(NOT is_routine_step)
        AND bool_and(configuration IS NULL) THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s rows', count(*))
FROM v_active_sessions
WHERE session_id = '01990000-0000-7000-8000-000000005113';

INSERT INTO verification_results
SELECT '3',
    'each session appears once for the owner',
    CASE
        WHEN count(*) = 2 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s rows', count(*))
FROM v_active_sessions
WHERE player_id = '01990000-0000-7000-8000-000000005101';

-- Every assertion above is an INSERT ... SELECT, so a missing
-- fixture row would make a check vanish silently (D192).
INSERT INTO verification_results
SELECT '4',
    'all 3 view-driven checks actually ran',
    CASE
        WHEN count(*) = 3 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 3 checks ran', count(*))
FROM verification_results
WHERE step IN ('1', '2', '3');

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
