-- ============================================================
-- Verification: 0043_stats_base_views_checks.sql
--
-- Runs assertions against a live database, since no PostgreSQL
-- server exists in the container that authored
-- migrations/0043_stats_base_views.sql (D193):
--
--   1. v_stats_session_facts: a completed standalone 501
--      VISUAL_BOARD session with 2 player turns (3 darts each,
--      totals 60 and 45) and 1 DartBot turn counts only the
--      owner's turns/darts/score, context_key STANDALONE.
--   2. The same session shape under an activity with an
--      activity_configurations row: context_key ROUTINE, still
--      exactly one row (no fan-out).
--   3. An abandoned session with zero turns: one row, all counts
--      zero.
--   4. An ACTIVE session: absent from both views.
--   5. A training exercise session (NULL game_type_id): absent.
--   6. v_stats_dart_facts: 6 rows for fixture 1 (not the
--      DartBot's), none for a QUICK_SCORE session.
--   7. idx_exercise_sessions_player_game_completed exists.
--
-- Everything runs inside one transaction that ends in ROLLBACK.
-- Lookup rows are resolved by implementation_key, never by
-- hardcoded id.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0043_stats_base_views_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0043.
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
        '01990000-0000-7000-8000-000000004301',
        'verification-0043-owner',
        'Verification Owner',
        now(),
        now()
    );

-- ------------------------------------------------------------
-- Fixture 1: completed standalone 501 VISUAL_BOARD session.
-- 2 player turns (3 darts each, totals 60 and 45) + 1 DartBot
-- turn (2 darts). Owner-scoping must exclude the DartBot's
-- turns and darts from every count.
-- ------------------------------------------------------------
INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004310',
        '01990000-0000-7000-8000-000000004301',
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
SELECT '01990000-0000-7000-8000-000000004311',
    '01990000-0000-7000-8000-000000004310',
    '01990000-0000-7000-8000-000000004301',
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
        '01990000-0000-7000-8000-000000004312',
        '01990000-0000-7000-8000-000000004311',
        (SELECT id FROM stage_types WHERE implementation_key = 'LEG'),
        1,
        now()
    );

INSERT INTO participants (id, exercise_session_id, participant_type_id, player_id, display_name, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004313',
        '01990000-0000-7000-8000-000000004311',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000004301',
        'Verification Owner',
        now()
    ),
    (
        '01990000-0000-7000-8000-000000004314',
        '01990000-0000-7000-8000-000000004311',
        (SELECT id FROM participant_types WHERE implementation_key = 'DARTBOT'),
        NULL,
        'DartBot',
        now()
    );

INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004320',
        '01990000-0000-7000-8000-000000004312',
        '01990000-0000-7000-8000-000000004313',
        1,
        60,
        now(),
        now()
    ),
    (
        '01990000-0000-7000-8000-000000004321',
        '01990000-0000-7000-8000-000000004312',
        '01990000-0000-7000-8000-000000004313',
        2,
        45,
        now(),
        now()
    ),
    (
        '01990000-0000-7000-8000-000000004322',
        '01990000-0000-7000-8000-000000004312',
        '01990000-0000-7000-8000-000000004314',
        1,
        26,
        now(),
        now()
    );

INSERT INTO darts (id, turn_id, dart_number, hit_target_number, hit_zone_id, score, location_x, location_y, created_at)
VALUES
    -- turn 1 (player): 3 darts, total 60
    ('01990000-0000-7000-8000-000000004330', '01990000-0000-7000-8000-000000004320', 1, 20, (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'), 20, 10.00, 10.00, now()),
    ('01990000-0000-7000-8000-000000004331', '01990000-0000-7000-8000-000000004320', 2, 20, (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'), 20, 11.00, 11.00, now()),
    ('01990000-0000-7000-8000-000000004332', '01990000-0000-7000-8000-000000004320', 3, 20, (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'), 20, 12.00, 12.00, now()),
    -- turn 2 (player): 3 darts, total 45
    ('01990000-0000-7000-8000-000000004333', '01990000-0000-7000-8000-000000004321', 1, 15, (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'), 15, 13.00, 13.00, now()),
    ('01990000-0000-7000-8000-000000004334', '01990000-0000-7000-8000-000000004321', 2, 15, (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'), 15, 14.00, 14.00, now()),
    ('01990000-0000-7000-8000-000000004335', '01990000-0000-7000-8000-000000004321', 3, 15, (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'), 15, 15.00, 15.00, now()),
    -- turn 3 (DartBot): 2 darts -- must never be counted
    ('01990000-0000-7000-8000-000000004336', '01990000-0000-7000-8000-000000004322', 1, 13, (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'), 13, 16.00, 16.00, now()),
    ('01990000-0000-7000-8000-000000004337', '01990000-0000-7000-8000-000000004322', 2, 13, (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'), 13, 17.00, 17.00, now());

-- ------------------------------------------------------------
-- Fixture 2: same session shape, but under an activity that has
-- an activity_configurations snapshot -- context_key ROUTINE.
-- ------------------------------------------------------------
INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004340',
        '01990000-0000-7000-8000-000000004301',
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        now() - interval '1 hour',
        now(),
        now()
    );

INSERT INTO activity_configurations (id, activity_id, configuration, created_at)
VALUES (
        gen_random_uuid(),
        '01990000-0000-7000-8000-000000004340',
        '{"routineTemplateId": "01990000-0000-7000-8000-00000000439f", "routineName": "Verify Routine", "steps": []}'::jsonb,
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
        routine_step_sequence_number,
        started_at,
        completed_at,
        created_at
    )
SELECT '01990000-0000-7000-8000-000000004341',
    '01990000-0000-7000-8000-000000004340',
    '01990000-0000-7000-8000-000000004301',
    (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'),
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
    (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
    rv.id,
    1,
    now() - interval '1 hour',
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = '501_V1';

INSERT INTO exercise_stages (id, exercise_session_id, stage_type_id, sequence_number, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004342',
        '01990000-0000-7000-8000-000000004341',
        (SELECT id FROM stage_types WHERE implementation_key = 'LEG'),
        1,
        now()
    );

INSERT INTO participants (id, exercise_session_id, participant_type_id, player_id, display_name, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004343',
        '01990000-0000-7000-8000-000000004341',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000004301',
        'Verification Owner',
        now()
    );

INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004344',
        '01990000-0000-7000-8000-000000004342',
        '01990000-0000-7000-8000-000000004343',
        1,
        30,
        now(),
        now()
    );

INSERT INTO darts (id, turn_id, dart_number, hit_target_number, hit_zone_id, score, location_x, location_y, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004345',
        '01990000-0000-7000-8000-000000004344',
        1,
        10,
        (SELECT id FROM dart_zones WHERE implementation_key = 'TREBLE'),
        30,
        18.00,
        18.00,
        now()
    );

-- ------------------------------------------------------------
-- Fixture 3: abandoned session, zero turns.
-- ------------------------------------------------------------
INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004350',
        '01990000-0000-7000-8000-000000004301',
        (SELECT id FROM game_statuses WHERE implementation_key = 'ABANDONED'),
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
SELECT '01990000-0000-7000-8000-000000004351',
    '01990000-0000-7000-8000-000000004350',
    '01990000-0000-7000-8000-000000004301',
    (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'),
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'ANALYTICS'),
    (SELECT id FROM input_modes WHERE implementation_key = 'VISUAL_BOARD'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'ABANDONED'),
    rv.id,
    now() - interval '1 hour',
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = '501_V1';

-- ------------------------------------------------------------
-- Fixture 4: ACTIVE session -- absent from both views.
-- ------------------------------------------------------------
INSERT INTO activities (id, player_id, status_id, started_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004360',
        '01990000-0000-7000-8000-000000004301',
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
SELECT '01990000-0000-7000-8000-000000004361',
    '01990000-0000-7000-8000-000000004360',
    '01990000-0000-7000-8000-000000004301',
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

-- ------------------------------------------------------------
-- Fixture 5: training exercise session (WARM_UP, NULL
-- game_type_id) -- absent from both views (INNER JOIN game_types
-- / ruleset_versions excludes it).
-- ------------------------------------------------------------
INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004370',
        '01990000-0000-7000-8000-000000004301',
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
        exercise_ruleset_version_id,
        status_id,
        started_at,
        completed_at,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000004371',
        '01990000-0000-7000-8000-000000004370',
        '01990000-0000-7000-8000-000000004301',
        (SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'),
        (SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'WARM_UP_V1'),
        (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
        now() - interval '1 hour',
        now(),
        now()
    );

-- ------------------------------------------------------------
-- Fixture 6: completed standalone 501 QUICK_SCORE session --
-- absent from v_stats_dart_facts (VISUAL_BOARD only).
-- ------------------------------------------------------------
INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004380',
        '01990000-0000-7000-8000-000000004301',
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
SELECT '01990000-0000-7000-8000-000000004381',
    '01990000-0000-7000-8000-000000004380',
    '01990000-0000-7000-8000-000000004301',
    (SELECT id FROM exercise_types WHERE implementation_key = 'GAME'),
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'RECREATIONAL'),
    (SELECT id FROM input_modes WHERE implementation_key = 'QUICK_SCORE'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'COMPLETED'),
    rv.id,
    now() - interval '1 hour',
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = '501_V1';

INSERT INTO exercise_stages (id, exercise_session_id, stage_type_id, sequence_number, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004382',
        '01990000-0000-7000-8000-000000004381',
        (SELECT id FROM stage_types WHERE implementation_key = 'LEG'),
        1,
        now()
    );

INSERT INTO participants (id, exercise_session_id, participant_type_id, player_id, display_name, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004383',
        '01990000-0000-7000-8000-000000004381',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000004301',
        'Verification Owner',
        now()
    );

INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004384',
        '01990000-0000-7000-8000-000000004382',
        '01990000-0000-7000-8000-000000004383',
        1,
        26,
        now(),
        now()
    );

INSERT INTO darts (id, turn_id, dart_number, hit_target_number, hit_zone_id, score, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004385',
        '01990000-0000-7000-8000-000000004384',
        1,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        26,
        now()
    );

-- ------------------------------------------------------------
-- Step 1: fixture 1 -- owner-scoped counts, STANDALONE.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1', 'v_stats_session_facts: fixture 1 owner-scoped counts and STANDALONE context',
    CASE WHEN count(*) = 1
          AND bool_and(turn_count = 2)
          AND bool_and(dart_count = 6)
          AND bool_and(counted_score = 105)
          AND bool_and(context_key = 'STANDALONE')
         THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s); turn_count=%s dart_count=%s counted_score=%s context_key=%s',
        count(*), max(turn_count), max(dart_count), max(counted_score), max(context_key))
FROM v_stats_session_facts
WHERE session_id = '01990000-0000-7000-8000-000000004311';

-- ------------------------------------------------------------
-- Step 2: fixture 2 -- ROUTINE context, single row (no fan-out).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2', 'v_stats_session_facts: fixture 2 is ROUTINE and does not fan out',
    CASE WHEN count(*) = 1 AND bool_and(context_key = 'ROUTINE') THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s); context_key=%s', count(*), max(context_key))
FROM v_stats_session_facts
WHERE session_id = '01990000-0000-7000-8000-000000004341';

-- ------------------------------------------------------------
-- Step 3: fixture 3 -- abandoned, zero turns, all counts zero.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3', 'v_stats_session_facts: abandoned zero-turn session has zeroed counts',
    CASE WHEN count(*) = 1
          AND bool_and(turn_count = 0)
          AND bool_and(dart_count = 0)
          AND bool_and(counted_score = 0)
         THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s); turn_count=%s dart_count=%s counted_score=%s',
        count(*), max(turn_count), max(dart_count), max(counted_score))
FROM v_stats_session_facts
WHERE session_id = '01990000-0000-7000-8000-000000004351';

-- ------------------------------------------------------------
-- Step 4: fixture 4 -- ACTIVE session absent from both views.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4', 'v_stats_session_facts: ACTIVE session is absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_stats_session_facts
WHERE session_id = '01990000-0000-7000-8000-000000004361';

INSERT INTO verification_results
SELECT '4', 'v_stats_dart_facts: ACTIVE session is absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_stats_dart_facts
WHERE session_id = '01990000-0000-7000-8000-000000004361';

-- ------------------------------------------------------------
-- Step 5: fixture 5 -- training exercise session absent.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '5', 'v_stats_session_facts: training exercise session (NULL game_type_id) is absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_stats_session_facts
WHERE session_id = '01990000-0000-7000-8000-000000004371';

INSERT INTO verification_results
SELECT '5', 'v_stats_dart_facts: training exercise session (NULL game_type_id) is absent',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_stats_dart_facts
WHERE session_id = '01990000-0000-7000-8000-000000004371';

-- ------------------------------------------------------------
-- Step 6: v_stats_dart_facts -- 6 owner rows for fixture 1, none
-- for the QUICK_SCORE session (fixture 6).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '6', 'v_stats_dart_facts: fixture 1 returns 6 owner rows (not the DartBot''s)',
    CASE WHEN count(*) = 6
          AND count(*) FILTER (WHERE hit_target_number = 13) = 0
         THEN 'PASS' ELSE 'FAIL' END,
    format('%s row(s), %s with the DartBot''s hit_target_number', count(*), count(*) FILTER (WHERE hit_target_number = 13))
FROM v_stats_dart_facts
WHERE session_id = '01990000-0000-7000-8000-000000004311';

INSERT INTO verification_results
SELECT '6', 'v_stats_dart_facts: QUICK_SCORE session (fixture 6) contributes no rows',
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    format('expected 0, found %s', count(*))
FROM v_stats_dart_facts
WHERE session_id = '01990000-0000-7000-8000-000000004381';

-- ------------------------------------------------------------
-- Step 7: the date-range index exists.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '7', 'idx_exercise_sessions_player_game_completed exists',
    CASE WHEN EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_exercise_sessions_player_game_completed'
    ) THEN 'PASS' ELSE 'FAIL' END,
    NULL;

-- ------------------------------------------------------------
-- Anti-vacuity guard (D192): assert the count of checks that
-- actually ran, separately from their pass/fail results.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '8', 'all 10 view-driven checks actually ran',
    CASE WHEN count(*) = 10 THEN 'PASS' ELSE 'FAIL' END,
    format('%s of 10 checks ran', count(*))
FROM verification_results
WHERE step IN ('1', '2', '3', '4', '5', '6', '7');

-- ------------------------------------------------------------
-- Results
-- ------------------------------------------------------------
SELECT step, result, check_name, detail
FROM verification_results
ORDER BY step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
