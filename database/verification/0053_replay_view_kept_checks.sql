-- ============================================================
-- Verification: 0053_replay_view_kept_checks.sql
--
-- Runs assertions against a live database for
-- migrations/0053_replay_view_kept.sql (D193):
--
--   1. A kept turn (the leader's dartless keep: no dart rows,
--      total_score 0) returns one row with kept = true and every
--      dart column NULL.
--   2. A thrown turn's dart rows all carry kept = false.
--   3. The widening adds a column, never rows: the fixture
--      session returns exactly one row per kept turn plus one per
--      dart.
--
-- Everything runs inside one transaction that ends in ROLLBACK,
-- so no fixture row survives. Lookup rows are resolved by
-- implementation_key, never by hardcoded id.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0053_replay_view_kept_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0053.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Fixture: one session, one stage, one participant. Turn 1 is a
-- kept turn with no darts; turn 2 is thrown with two darts.
-- ------------------------------------------------------------
INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES (
        '01990000-0000-7000-8000-000000005401',
        'verification-0053-owner',
        'Verification Owner',
        now(),
        now()
    );

INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000005402',
        '01990000-0000-7000-8000-000000005401',
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        now() - interval '1 hour',
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
        completed_at,
        created_at
    )
SELECT '01990000-0000-7000-8000-000000005403',
    '01990000-0000-7000-8000-000000005402',
    '01990000-0000-7000-8000-000000005401',
    (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'),
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
    (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
    rv.id,
    now() - interval '1 hour',
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = '501_V1';

INSERT INTO exercise_stages (id, exercise_session_id, stage_type_id, sequence_number, created_at)
VALUES (
        '01990000-0000-7000-8000-000000005404',
        '01990000-0000-7000-8000-000000005403',
        (SELECT id FROM stage_types WHERE implementation_key = 'LEG'),
        1,
        now()
    );

INSERT INTO participants (id, exercise_session_id, participant_type_id, player_id, display_name, created_at)
VALUES (
        '01990000-0000-7000-8000-000000005405',
        '01990000-0000-7000-8000-000000005403',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000005401',
        'Verification Owner',
        now()
    );

INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, kept, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000005410',
        '01990000-0000-7000-8000-000000005404',
        '01990000-0000-7000-8000-000000005405',
        1,
        0,
        true,
        now(),
        now()
    ),
    (
        '01990000-0000-7000-8000-000000005411',
        '01990000-0000-7000-8000-000000005404',
        '01990000-0000-7000-8000-000000005405',
        2,
        38,
        false,
        now(),
        now()
    );

INSERT INTO darts (id, turn_id, dart_number, hit_target_number, hit_zone_id, score, created_at)
VALUES (
        '01990000-0000-7000-8000-000000005420',
        '01990000-0000-7000-8000-000000005411',
        1,
        18,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        18,
        now()
    ),
    (
        '01990000-0000-7000-8000-000000005421',
        '01990000-0000-7000-8000-000000005411',
        2,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        20,
        now()
    );

-- ------------------------------------------------------------
-- Step 1: the kept turn returns one row, kept = true, no dart.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'Kept turn returns one row with kept = true and NULL dart columns',
    CASE
        WHEN count(*) = 1
            AND bool_and(kept)
            AND bool_and(dart_number IS NULL)
            AND bool_and(turn_total_score = 0)
        THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s row(s); kept=%s dart_number=%s', count(*), bool_and(kept), max(dart_number))
FROM v_game_replay
WHERE session_id = '01990000-0000-7000-8000-000000005403'
    AND turn_sequence = 1;

-- ------------------------------------------------------------
-- Step 2: the thrown turn's dart rows all carry kept = false.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'Thrown turn dart rows carry kept = false',
    CASE
        WHEN count(*) = 2 AND NOT bool_or(kept) THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s row(s); any kept=%s', count(*), bool_or(kept))
FROM v_game_replay
WHERE session_id = '01990000-0000-7000-8000-000000005403'
    AND turn_sequence = 2;

-- ------------------------------------------------------------
-- Step 3: one row per kept turn plus one per dart -- no fan-out.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    'Fixture session returns 3 rows (1 kept turn + 2 darts)',
    CASE WHEN count(*) = 3 THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s)', count(*))
FROM v_game_replay
WHERE session_id = '01990000-0000-7000-8000-000000005403';

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
