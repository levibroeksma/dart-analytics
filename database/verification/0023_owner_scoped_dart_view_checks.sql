-- ============================================================
-- Verification: 0023_owner_scoped_dart_view_checks.sql
--
-- Runs assertions against a live database, since no PostgreSQL
-- server exists in the container that authored
-- migrations/0023_owner_scoped_dart_views.sql (D193 — SQL that
-- cannot be applied locally ships with a verification script the
-- owner runs against the real Neon database before merge):
--
--   1. v_dart_analytics returns only the session owner's own
--      dart, not a GUEST participant's, for a session with one
--      of each
--   2. v_dart_locations does the same
--   3. v_game_replay returns BOTH participants' turns for the
--      same session — proving the lack of owner-scoping there
--      (migration 0023's own comment) is deliberate, not a gap
--      this script is failing to also catch
--
-- Everything runs inside one transaction that ends in ROLLBACK,
-- so no fixture row survives. Lookup rows are resolved by
-- implementation_key, never by hardcoded id.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0023_owner_scoped_dart_view_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0023.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Fixture: one session, one PLAYER participant (the session
-- owner) and one GUEST participant, each with one turn and one
-- dart. Each dart sets both the intended-target pair (required
-- by v_dart_analytics) and the location pair (required by
-- v_dart_locations), so a single fixture dart per participant
-- proves both views at once. The two darts use distinct
-- hit_target_number and location_x values so a check can tell
-- whose row it is looking at.
-- ------------------------------------------------------------
INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES (
        '01990000-0000-7000-8000-000000002301',
        'verification-0023-owner',
        'Verification Owner',
        now(),
        now()
    );

INSERT INTO activities (id, player_id, status_id, started_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000002302',
        '01990000-0000-7000-8000-000000002301',
        (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
        now(),
        now()
    );

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
SELECT '01990000-0000-7000-8000-000000002303',
    '01990000-0000-7000-8000-000000002302',
    '01990000-0000-7000-8000-000000002301',
    rv.game_type_id,
    (SELECT id FROM capture_modes WHERE implementation_key = 'RECREATIONAL'),
    (SELECT id FROM input_modes WHERE implementation_key = 'QUICK_SCORE'),
    (SELECT id FROM game_statuses WHERE implementation_key = 'ACTIVE'),
    rv.id,
    now(),
    now()
FROM ruleset_versions rv
WHERE rv.implementation_key = 'TUOD_V1';

INSERT INTO exercise_stages (
        id,
        exercise_session_id,
        stage_type_id,
        sequence_number,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000002304',
        '01990000-0000-7000-8000-000000002303',
        (SELECT id FROM stage_types WHERE implementation_key = 'MATCH'),
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
        '01990000-0000-7000-8000-000000002305',
        '01990000-0000-7000-8000-000000002303',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000002301',
        'Verification Owner',
        now()
    ),
    (
        '01990000-0000-7000-8000-000000002306',
        '01990000-0000-7000-8000-000000002303',
        (SELECT id FROM participant_types WHERE implementation_key = 'GUEST'),
        NULL,
        'Verification Guest',
        now()
    );

INSERT INTO turns (
        id,
        exercise_stage_id,
        participant_id,
        sequence_number,
        total_score,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000002307',
        '01990000-0000-7000-8000-000000002304',
        '01990000-0000-7000-8000-000000002305',
        1,
        20,
        now()
    ),
    (
        '01990000-0000-7000-8000-000000002308',
        '01990000-0000-7000-8000-000000002304',
        '01990000-0000-7000-8000-000000002306',
        1,
        19,
        now()
    );

INSERT INTO darts (
        id,
        turn_id,
        dart_number,
        intended_target_number,
        intended_zone_id,
        hit_target_number,
        hit_zone_id,
        score,
        location_x,
        location_y,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-000000002309',
        '01990000-0000-7000-8000-000000002307',
        1,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        20,
        5.00,
        5.00,
        now()
    ),
    (
        '01990000-0000-7000-8000-00000000230a',
        '01990000-0000-7000-8000-000000002308',
        1,
        19,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        19,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        19,
        -5.00,
        -5.00,
        now()
    );

-- ------------------------------------------------------------
-- Step 1: v_dart_analytics returns only the owner's dart.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'v_dart_analytics returns exactly 1 row for the fixture session',
    CASE
        WHEN count(*) = 1 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 1, found %s', count(*))
FROM v_dart_analytics
WHERE session_id = '01990000-0000-7000-8000-000000002303';

INSERT INTO verification_results
SELECT '1',
    'v_dart_analytics row belongs to the PLAYER, not the GUEST',
    CASE
        WHEN hit_target_number = 20 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('hit_target_number=%s (expected 20, the owner''s dart -- 19 would be the guest''s)', hit_target_number)
FROM v_dart_analytics
WHERE session_id = '01990000-0000-7000-8000-000000002303';

-- ------------------------------------------------------------
-- Step 2: v_dart_locations returns only the owner's dart.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'v_dart_locations returns exactly 1 row for the fixture session',
    CASE
        WHEN count(*) = 1 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 1, found %s', count(*))
FROM v_dart_locations
WHERE session_id = '01990000-0000-7000-8000-000000002303';

INSERT INTO verification_results
SELECT '2',
    'v_dart_locations row belongs to the PLAYER, not the GUEST',
    CASE
        WHEN location_x = 5.00 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('location_x=%s (expected 5.00, the owner''s dart -- -5.00 would be the guest''s)', location_x)
FROM v_dart_locations
WHERE session_id = '01990000-0000-7000-8000-000000002303';

-- ------------------------------------------------------------
-- Step 3: v_game_replay is deliberately NOT owner-scoped -- it
-- must return BOTH participants' turns for the same session.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    'v_game_replay returns 2 turn rows (one per participant) for the fixture session',
    CASE
        WHEN count(*) = 2 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 2, found %s', count(*))
FROM v_game_replay
WHERE session_id = '01990000-0000-7000-8000-000000002303';

INSERT INTO verification_results
SELECT '3',
    'v_game_replay rows are Verification Owner and Verification Guest',
    CASE
        WHEN names.agg = ARRAY['Verification Guest', 'Verification Owner'] THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('found participant_name(s): %s', names.agg)
FROM (
        SELECT array_agg(
                DISTINCT participant_name
                ORDER BY participant_name
            ) AS agg
        FROM v_game_replay
        WHERE session_id = '01990000-0000-7000-8000-000000002303'
    ) names;

-- ------------------------------------------------------------
-- Anti-vacuity guard: several checks above are driven by a
-- SELECT against a view, so a broken column could make one
-- vanish silently instead of failing. Assert the count of
-- checks that actually ran separately (D192).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4',
    'all 6 view-driven checks actually ran',
    CASE
        WHEN count(*) = 6 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 6 checks ran', count(*))
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
