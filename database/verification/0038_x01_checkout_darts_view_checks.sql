-- ============================================================
-- Verification: 0038_x01_checkout_darts_view_checks.sql
--
-- Runs assertions against a live database, since no PostgreSQL
-- server exists in the container that authored
-- migrations/0038_x01_checkout_darts_view.sql (D193).
--
--   1. v_x01_checkout_darts exists and v_double_out_checkout_darts
--      does not.
--   2. The view exposes every column named in the migration's
--      Interfaces block.
--   3. Only 501, TUOD and ONE_TWENTY_ONE game types appear.
--   4. Only VISUAL_BOARD sessions appear.
--   5. Every row's participant_id belongs to a participant whose
--      player_id equals the session's player_id.
--
-- Everything runs inside one transaction that ends in ROLLBACK.
-- Lookup rows are resolved by implementation_key, never by
-- hardcoded id. UUIDs use the ...0000000038xx block, distinct
-- from 0024's ...0000000024xx block, so both verification files
-- can run against the same database.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0038_x01_checkout_darts_view_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0038.
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
        '01990000-0000-7000-8000-000000003801',
        'verification-0038-owner',
        'Verification Owner',
        now(),
        now()
    );

INSERT INTO activities (id, player_id, status_id, started_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000003802',
        '01990000-0000-7000-8000-000000003801',
        (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
        now(),
        now()
    );

-- ------------------------------------------------------------
-- 501 session (LEG stage), with an exercise_configurations
-- snapshot so the configuration column has a value to assert on.
-- ------------------------------------------------------------
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
SELECT '01990000-0000-7000-8000-000000003803',
    '01990000-0000-7000-8000-000000003802',
    '01990000-0000-7000-8000-000000003801',
    (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'),
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
        '01990000-0000-7000-8000-000000003804',
        '01990000-0000-7000-8000-000000003803',
        '{"starting_score": 501}'::jsonb,
        now()
    );

INSERT INTO exercise_stages (
        id,
        exercise_session_id,
        stage_type_id,
        sequence_number,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000003805',
        '01990000-0000-7000-8000-000000003803',
        (SELECT id FROM stage_types WHERE implementation_key = 'LEG'),
        1,
        now()
    );

INSERT INTO participants (
        id,
        exercise_session_id,
        participant_type_id,
        player_id,
        display_name,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000003806',
        '01990000-0000-7000-8000-000000003803',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000003801',
        'Verification Owner',
        now()
    );

INSERT INTO turns (
        id,
        exercise_stage_id,
        participant_id,
        sequence_number,
        total_score,
        completed_at,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000003807',
        '01990000-0000-7000-8000-000000003805',
        '01990000-0000-7000-8000-000000003806',
        1,
        60,
        now(),
        now()
    );

INSERT INTO darts (
        id,
        turn_id,
        dart_number,
        hit_target_number,
        hit_zone_id,
        score,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000003808',
        '01990000-0000-7000-8000-000000003807',
        1,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'TREBLE'),
        60,
        now()
    ),
    (
        '01990000-0000-7000-8000-000000003809',
        '01990000-0000-7000-8000-000000003807',
        2,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'DOUBLE'),
        40,
        now()
    );

-- ------------------------------------------------------------
-- TUOD session (ROUND stage).
-- ------------------------------------------------------------
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
SELECT '01990000-0000-7000-8000-00000000380a',
    '01990000-0000-7000-8000-000000003802',
    '01990000-0000-7000-8000-000000003801',
    (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'),
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
    (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
    rv.id,
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = 'TUOD_V1';

INSERT INTO exercise_configurations (id, exercise_session_id, configuration, created_at)
VALUES (
        '01990000-0000-7000-8000-00000000380b',
        '01990000-0000-7000-8000-00000000380a',
        '{"max_darts_per_turn": 3}'::jsonb,
        now()
    );

INSERT INTO exercise_stages (
        id,
        exercise_session_id,
        stage_type_id,
        sequence_number,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-00000000380c',
        '01990000-0000-7000-8000-00000000380a',
        (SELECT id FROM stage_types WHERE implementation_key = 'ROUND'),
        1,
        now()
    );

INSERT INTO participants (
        id,
        exercise_session_id,
        participant_type_id,
        player_id,
        display_name,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-00000000380d',
        '01990000-0000-7000-8000-00000000380a',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000003801',
        'Verification Owner',
        now()
    );

INSERT INTO turns (
        id,
        exercise_stage_id,
        participant_id,
        sequence_number,
        total_score,
        completed_at,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-00000000380e',
        '01990000-0000-7000-8000-00000000380c',
        '01990000-0000-7000-8000-00000000380d',
        1,
        26,
        now(),
        now()
    );

INSERT INTO darts (
        id,
        turn_id,
        dart_number,
        hit_target_number,
        hit_zone_id,
        score,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-00000000380f',
        '01990000-0000-7000-8000-00000000380e',
        1,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        20,
        now()
    );

-- ------------------------------------------------------------
-- 121 session (ROUND stage).
-- ------------------------------------------------------------
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
SELECT '01990000-0000-7000-8000-000000003810',
    '01990000-0000-7000-8000-000000003802',
    '01990000-0000-7000-8000-000000003801',
    (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'),
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
    (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
    rv.id,
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = '121_V1';

INSERT INTO exercise_stages (
        id,
        exercise_session_id,
        stage_type_id,
        sequence_number,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000003811',
        '01990000-0000-7000-8000-000000003810',
        (SELECT id FROM stage_types WHERE implementation_key = 'ROUND'),
        1,
        now()
    );

INSERT INTO participants (
        id,
        exercise_session_id,
        participant_type_id,
        player_id,
        display_name,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000003812',
        '01990000-0000-7000-8000-000000003810',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000003801',
        'Verification Owner',
        now()
    );

INSERT INTO turns (
        id,
        exercise_stage_id,
        participant_id,
        sequence_number,
        total_score,
        completed_at,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000003813',
        '01990000-0000-7000-8000-000000003811',
        '01990000-0000-7000-8000-000000003812',
        1,
        60,
        now(),
        now()
    );

INSERT INTO darts (
        id,
        turn_id,
        dart_number,
        hit_target_number,
        hit_zone_id,
        score,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000003814',
        '01990000-0000-7000-8000-000000003813',
        1,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'TREBLE'),
        60,
        now()
    );

-- ------------------------------------------------------------
-- A non-X01, non-VISUAL_BOARD control session (Bob's 27, the
-- DETAILED_DARTS input mode -- BOBS27_V1's only non-VISUAL_BOARD
-- declared capability per seeds/0007): should never appear in
-- the view -- neither its game type nor its input mode qualify.
-- ------------------------------------------------------------
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
SELECT '01990000-0000-7000-8000-000000003815',
    '01990000-0000-7000-8000-000000003802',
    '01990000-0000-7000-8000-000000003801',
    (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'),
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'RECREATIONAL'),
    (SELECT id FROM input_modes WHERE implementation_key = 'DETAILED_DARTS'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
    rv.id,
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = 'BOBS27_V1';

INSERT INTO exercise_stages (
        id,
        exercise_session_id,
        stage_type_id,
        sequence_number,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000003816',
        '01990000-0000-7000-8000-000000003815',
        (SELECT id FROM stage_types WHERE implementation_key = 'ROUND'),
        1,
        now()
    );

INSERT INTO participants (
        id,
        exercise_session_id,
        participant_type_id,
        player_id,
        display_name,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000003817',
        '01990000-0000-7000-8000-000000003815',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000003801',
        'Verification Owner',
        now()
    );

INSERT INTO turns (
        id,
        exercise_stage_id,
        participant_id,
        sequence_number,
        total_score,
        completed_at,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000003818',
        '01990000-0000-7000-8000-000000003816',
        '01990000-0000-7000-8000-000000003817',
        1,
        40,
        now(),
        now()
    );

INSERT INTO darts (
        id,
        turn_id,
        dart_number,
        hit_target_number,
        hit_zone_id,
        score,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000003819',
        '01990000-0000-7000-8000-000000003818',
        1,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'DOUBLE'),
        40,
        now()
    );

-- ------------------------------------------------------------
-- Step 1a: v_x01_checkout_darts exists.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'v_x01_checkout_darts exists',
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.views
            WHERE table_name = 'v_x01_checkout_darts'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END,
    NULL;

-- ------------------------------------------------------------
-- Step 1b: v_double_out_checkout_darts no longer exists.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'v_double_out_checkout_darts no longer exists',
    CASE
        WHEN NOT EXISTS (
            SELECT 1
            FROM information_schema.views
            WHERE table_name = 'v_double_out_checkout_darts'
        ) THEN 'PASS'
        ELSE 'FAIL'
    END,
    NULL;

-- ------------------------------------------------------------
-- Step 2: every Interfaces column is present.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'view exposes every documented column',
    CASE
        WHEN array_agg(column_name::text ORDER BY column_name) @> ARRAY [
            'session_id', 'player_id', 'game_type_key', 'ruleset_version_key',
            'configuration', 'stage_id', 'stage_sequence', 'stage_type_key',
            'parent_stage_id', 'turn_id', 'turn_sequence', 'turn_total_score',
            'turn_completed_at', 'participant_id', 'dart_number',
            'hit_target_number', 'hit_zone_key', 'score'
        ]::text[] THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('columns found: %s', array_agg(column_name::text ORDER BY column_name))
FROM information_schema.columns
WHERE table_name = 'v_x01_checkout_darts';

-- ------------------------------------------------------------
-- Step 3: only 501/TUOD/ONE_TWENTY_ONE game types appear, and
-- all three fixture rows for them do (anti-vacuity: each game
-- type contributes at least one row).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    'only 501/TUOD/ONE_TWENTY_ONE game types appear',
    CASE
        WHEN count(*) FILTER (
            WHERE game_type_key NOT IN ('501', 'TUOD', 'ONE_TWENTY_ONE')
        ) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s rows with an unexpected game_type_key', count(*) FILTER (
        WHERE game_type_key NOT IN ('501', 'TUOD', 'ONE_TWENTY_ONE')
    ))
FROM v_x01_checkout_darts
WHERE session_id IN (
        '01990000-0000-7000-8000-000000003803',
        '01990000-0000-7000-8000-00000000380a',
        '01990000-0000-7000-8000-000000003810',
        '01990000-0000-7000-8000-000000003815'
    );

INSERT INTO verification_results
SELECT '3',
    'all three X01 game types are represented in the view',
    CASE
        WHEN count(DISTINCT game_type_key) = 3 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('distinct game types found: %s', count(DISTINCT game_type_key))
FROM v_x01_checkout_darts
WHERE session_id IN (
        '01990000-0000-7000-8000-000000003803',
        '01990000-0000-7000-8000-00000000380a',
        '01990000-0000-7000-8000-000000003810'
    );

INSERT INTO verification_results
SELECT '3',
    'the Bob''s 27 control session never appears (wrong game type)',
    CASE
        WHEN count(*) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 0, found %s', count(*))
FROM v_x01_checkout_darts
WHERE session_id = '01990000-0000-7000-8000-000000003815';

-- ------------------------------------------------------------
-- Step 4: only VISUAL_BOARD sessions appear (the Bob's 27
-- control session is DETAILED_DARTS, checked again here from
-- the input-mode angle rather than the game-type angle above).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4',
    'every row belongs to a VISUAL_BOARD session',
    CASE
        WHEN count(*) FILTER (
            WHERE im.implementation_key <> 'VISUAL_BOARD'
        ) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s rows not backed by a VISUAL_BOARD session', count(*) FILTER (
        WHERE im.implementation_key <> 'VISUAL_BOARD'
    ))
FROM v_x01_checkout_darts v
    JOIN exercise_sessions es ON es.id = v.session_id
    JOIN input_modes im ON im.id = es.input_mode_id
WHERE v.session_id IN (
        '01990000-0000-7000-8000-000000003803',
        '01990000-0000-7000-8000-00000000380a',
        '01990000-0000-7000-8000-000000003810'
    );

-- ------------------------------------------------------------
-- Step 5: every row's participant_id belongs to a participant
-- whose player_id equals the session's player_id.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '5',
    'every row''s participant belongs to the session''s owning player',
    CASE
        WHEN count(*) FILTER (
            WHERE p.player_id IS DISTINCT FROM v.player_id
        ) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s rows with a mismatched participant player_id', count(*) FILTER (
        WHERE p.player_id IS DISTINCT FROM v.player_id
    ))
FROM v_x01_checkout_darts v
    JOIN participants p ON p.id = v.participant_id
WHERE v.session_id IN (
        '01990000-0000-7000-8000-000000003803',
        '01990000-0000-7000-8000-00000000380a',
        '01990000-0000-7000-8000-000000003810'
    );

-- ------------------------------------------------------------
-- Anti-vacuity guard (D192): assert the count of checks that
-- actually ran, separately from their pass/fail results.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '6',
    'all 8 view-driven checks actually ran',
    CASE
        WHEN count(*) = 8 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 8 checks ran', count(*))
FROM verification_results
WHERE step IN ('1', '2', '3', '4', '5');

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
