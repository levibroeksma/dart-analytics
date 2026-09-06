-- ============================================================
-- Verification: 0025_player_visit_facts_view_checks.sql
--
-- Runs assertions against a live database (D193).
--
--   1. a QUICK_SCORE turn (no dart rows) reports dart_count = 0
--   2. a VISUAL_BOARD turn with 2 dart rows reports dart_count = 2
--   3. configured_max_darts_per_turn reflects the JSONB snapshot
--   4. an open (uncompleted) turn never appears
--   5. a guest participant's turn never appears
--
-- Everything runs inside one transaction that ends in ROLLBACK.
-- Lookup rows are resolved by implementation_key, never by
-- hardcoded id.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0025_player_visit_facts_view_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0025.
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
        '01990000-0000-7000-8000-000000002501',
        'verification-0025-owner',
        'Verification Owner',
        now(),
        now()
    );

INSERT INTO activities (id, player_id, status_id, started_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002502',
        '01990000-0000-7000-8000-000000002501',
        (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
        now(),
        now()
    );

-- ------------------------------------------------------------
-- Session A: TUOD, RECREATIONAL + QUICK_SCORE (no dart rows).
-- ------------------------------------------------------------
INSERT INTO exercise_sessions (
        id,
        activity_id,
        player_id,
        game_type_id,
        capture_mode_id,
        input_mode_id,
        status_id,
        ruleset_version_id,
        started_at,
        created_at
    )
SELECT '01990000-0000-7000-8000-000000002503',
    '01990000-0000-7000-8000-000000002502',
    '01990000-0000-7000-8000-000000002501',
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'RECREATIONAL'),
    (SELECT id FROM input_modes WHERE implementation_key = 'QUICK_SCORE'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
    rv.id,
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = 'TUOD_V1';

INSERT INTO exercise_configurations (id, exercise_session_id, configuration, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002504',
        '01990000-0000-7000-8000-000000002503',
        '{"max_darts_per_turn": 3}'::jsonb,
        now()
    );

INSERT INTO exercise_stages (id, exercise_session_id, stage_type_id, sequence_number, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002505',
        '01990000-0000-7000-8000-000000002503',
        (SELECT id FROM stage_types WHERE implementation_key = 'ROUND'),
        1,
        now()
    );

INSERT INTO participants (id, exercise_session_id, participant_type_id, player_id, display_name, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002506',
        '01990000-0000-7000-8000-000000002503',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000002501',
        'Verification Owner',
        now()
    );

-- Turn 1: completed, no darts (QUICK_SCORE).
INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002507',
        '01990000-0000-7000-8000-000000002505',
        '01990000-0000-7000-8000-000000002506',
        1,
        45,
        now(),
        now()
    );

-- Turn 2: still open -- must never appear.
INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002508',
        '01990000-0000-7000-8000-000000002505',
        '01990000-0000-7000-8000-000000002506',
        2,
        0,
        NULL,
        now()
    );

-- ------------------------------------------------------------
-- Session B: 501, ANALYTICS + VISUAL_BOARD (2 dart rows), plus a
-- guest participant's turn in the same session (must not appear).
-- ------------------------------------------------------------
INSERT INTO exercise_sessions (
        id,
        activity_id,
        player_id,
        game_type_id,
        capture_mode_id,
        input_mode_id,
        status_id,
        ruleset_version_id,
        started_at,
        created_at
    )
SELECT '01990000-0000-7000-8000-000000002509',
    '01990000-0000-7000-8000-000000002502',
    '01990000-0000-7000-8000-000000002501',
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
    (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
    rv.id,
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = '501_V1';

INSERT INTO exercise_configurations (id, exercise_session_id, configuration, created_at)
VALUES (
        '01990000-0000-7000-8000-00000000250a',
        '01990000-0000-7000-8000-000000002509',
        '{"max_darts_per_turn": 3, "starting_score": 501}'::jsonb,
        now()
    );

INSERT INTO exercise_stages (id, exercise_session_id, stage_type_id, sequence_number, created_at)
VALUES (
        '01990000-0000-7000-8000-00000000250b',
        '01990000-0000-7000-8000-000000002509',
        (SELECT id FROM stage_types WHERE implementation_key = 'LEG'),
        1,
        now()
    );

INSERT INTO participants (id, exercise_session_id, participant_type_id, player_id, display_name, created_at)
VALUES (
        '01990000-0000-7000-8000-00000000250c',
        '01990000-0000-7000-8000-000000002509',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000002501',
        'Verification Owner',
        now()
    ),
    (
        '01990000-0000-7000-8000-00000000250d',
        '01990000-0000-7000-8000-000000002509',
        (SELECT id FROM participant_types WHERE implementation_key = 'GUEST'),
        NULL,
        'Guest Opponent',
        now()
    );

-- Owner's turn: completed, 2 darts.
INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-00000000250e',
        '01990000-0000-7000-8000-00000000250b',
        '01990000-0000-7000-8000-00000000250c',
        1,
        100,
        now(),
        now()
    );

INSERT INTO darts (id, turn_id, dart_number, hit_target_number, hit_zone_id, score, created_at)
VALUES (
        '01990000-0000-7000-8000-00000000250f',
        '01990000-0000-7000-8000-00000000250e',
        1,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'TREBLE'),
        60,
        now()
    ),
    (
        '01990000-0000-7000-8000-000000002510',
        '01990000-0000-7000-8000-00000000250e',
        2,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'TREBLE'),
        40,
        now()
    );

-- Guest's turn in the same session: must never appear.
INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002511',
        '01990000-0000-7000-8000-00000000250b',
        '01990000-0000-7000-8000-00000000250d',
        1,
        60,
        now(),
        now()
    );

-- ------------------------------------------------------------
-- Step 1: QUICK_SCORE turn reports dart_count = 0.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'QUICK_SCORE turn reports dart_count = 0',
    CASE WHEN dart_count = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('dart_count=%s (expected 0)', dart_count)
FROM v_player_visit_facts
WHERE session_id = '01990000-0000-7000-8000-000000002503'
    AND turn_sequence = 1;

-- ------------------------------------------------------------
-- Step 2: VISUAL_BOARD turn reports dart_count = 2.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'VISUAL_BOARD turn reports dart_count = 2',
    CASE WHEN dart_count = 2 THEN 'PASS' ELSE 'FAIL' END,
    format('dart_count=%s (expected 2)', dart_count)
FROM v_player_visit_facts
WHERE session_id = '01990000-0000-7000-8000-000000002509'
    AND turn_sequence = 1
    AND stage_id = '01990000-0000-7000-8000-00000000250b';

-- ------------------------------------------------------------
-- Step 3: configured_max_darts_per_turn reflects the JSONB.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    'configured_max_darts_per_turn reads the JSONB snapshot',
    CASE WHEN configured_max_darts_per_turn = 3 THEN 'PASS' ELSE 'FAIL' END,
    format('configured_max_darts_per_turn=%s (expected 3)', configured_max_darts_per_turn)
FROM v_player_visit_facts
WHERE session_id = '01990000-0000-7000-8000-000000002503'
    AND turn_sequence = 1;

-- ------------------------------------------------------------
-- Step 4: the open turn never appears.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4',
    'an open (uncompleted) turn does not appear',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_player_visit_facts
WHERE session_id = '01990000-0000-7000-8000-000000002503'
    AND turn_sequence = 2;

-- ------------------------------------------------------------
-- Step 5: the guest's turn never appears.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '5',
    'a guest participant''s turn does not appear',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_player_visit_facts
WHERE session_id = '01990000-0000-7000-8000-000000002509'
    AND total_score = 60;

-- ------------------------------------------------------------
-- Anti-vacuity guard (D192).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '6',
    'all 5 view-driven checks actually ran',
    CASE WHEN count(*) = 5 THEN 'PASS' ELSE 'FAIL' END,
    format('%s of 5 checks ran', count(*))
FROM verification_results
WHERE step IN ('1', '2', '3', '4', '5');

SELECT step, result, check_name, detail FROM verification_results ORDER BY step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
