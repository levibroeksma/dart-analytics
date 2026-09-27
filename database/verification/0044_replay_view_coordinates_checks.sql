-- ============================================================
-- Verification: 0044_replay_view_coordinates_checks.sql
--
-- Runs assertions against a live database, since no PostgreSQL
-- server exists in the container that authored
-- migrations/0044_replay_view_coordinates.sql (D193):
--
--   1. A VISUAL_BOARD dart's location_x/location_y come back
--      unchanged.
--   2. A bounce-out dart (landing point never seen) returns NULL
--      for both location columns.
--   3. A turn-total-only turn (no dart rows at all) returns one
--      row with every dart column NULL and a non-null
--      participant_id.
--   4. PLAYER, GUEST and DARTBOT participants in the same session
--      each appear with their own participant_type_key.
--   5. The widening adds columns, never rows: the view's row
--      count for the fixture session equals the row count of an
--      inline CTE reproducing the pre-0044 (0016) select list and
--      join graph verbatim.
--
-- Everything runs inside one transaction that ends in ROLLBACK,
-- so no fixture row survives. Lookup rows are resolved by
-- implementation_key, never by hardcoded id.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0044_replay_view_coordinates_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0044.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Fixture: one session, one stage, three participants (PLAYER
-- the session owner, GUEST, DARTBOT).
--
--   * PLAYER turn 1: one VISUAL_BOARD dart with a seen landing
--     point (assertion 1).
--   * PLAYER turn 2: one bounce-out dart -- intended target set,
--     hit side and location both NULL (assertion 2).
--   * PLAYER turn 3: a turn-total-only turn with no dart rows at
--     all (assertion 3).
--   * GUEST turn 1 and DARTBOT turn 1: one landed dart each, so
--     all three participant types appear (assertion 4).
-- ------------------------------------------------------------
INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES (
        '01990000-0000-7000-8000-000000004401',
        'verification-0044-owner',
        'Verification Owner',
        now(),
        now()
    );

INSERT INTO activities (id, player_id, status_id, started_at, completed_at, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004402',
        '01990000-0000-7000-8000-000000004401',
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
SELECT '01990000-0000-7000-8000-000000004403',
    '01990000-0000-7000-8000-000000004402',
    '01990000-0000-7000-8000-000000004401',
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
        '01990000-0000-7000-8000-000000004404',
        '01990000-0000-7000-8000-000000004403',
        (SELECT id FROM stage_types WHERE implementation_key = 'LEG'),
        1,
        now()
    );

INSERT INTO participants (id, exercise_session_id, participant_type_id, player_id, display_name, created_at)
VALUES (
        '01990000-0000-7000-8000-000000004405',
        '01990000-0000-7000-8000-000000004403',
        (SELECT id FROM participant_types WHERE implementation_key = 'PLAYER'),
        '01990000-0000-7000-8000-000000004401',
        'Verification Owner',
        now()
    ),
    (
        '01990000-0000-7000-8000-000000004406',
        '01990000-0000-7000-8000-000000004403',
        (SELECT id FROM participant_types WHERE implementation_key = 'GUEST'),
        NULL,
        'Verification Guest',
        now()
    ),
    (
        '01990000-0000-7000-8000-000000004407',
        '01990000-0000-7000-8000-000000004403',
        (SELECT id FROM participant_types WHERE implementation_key = 'DARTBOT'),
        NULL,
        'DartBot',
        now()
    );

INSERT INTO turns (id, exercise_stage_id, participant_id, sequence_number, total_score, completed_at, created_at)
VALUES (
        -- PLAYER turn 1: VISUAL_BOARD dart with a seen landing point.
        '01990000-0000-7000-8000-000000004410',
        '01990000-0000-7000-8000-000000004404',
        '01990000-0000-7000-8000-000000004405',
        1,
        20,
        now(),
        now()
    ),
    (
        -- PLAYER turn 2: bounce-out dart.
        '01990000-0000-7000-8000-000000004411',
        '01990000-0000-7000-8000-000000004404',
        '01990000-0000-7000-8000-000000004405',
        2,
        0,
        now(),
        now()
    ),
    (
        -- PLAYER turn 3: turn-total-only, no dart rows.
        '01990000-0000-7000-8000-000000004412',
        '01990000-0000-7000-8000-000000004404',
        '01990000-0000-7000-8000-000000004405',
        3,
        26,
        now(),
        now()
    ),
    (
        -- GUEST turn 1.
        '01990000-0000-7000-8000-000000004413',
        '01990000-0000-7000-8000-000000004404',
        '01990000-0000-7000-8000-000000004406',
        1,
        19,
        now(),
        now()
    ),
    (
        -- DARTBOT turn 1.
        '01990000-0000-7000-8000-000000004414',
        '01990000-0000-7000-8000-000000004404',
        '01990000-0000-7000-8000-000000004407',
        1,
        25,
        now(),
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
        -- PLAYER turn 1's dart: landing point seen.
        '01990000-0000-7000-8000-000000004420',
        '01990000-0000-7000-8000-000000004410',
        1,
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        20,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        20,
        12.34,
        -56.78,
        now()
    ),
    (
        -- PLAYER turn 2's dart: bounce-out, landing point never seen.
        '01990000-0000-7000-8000-000000004421',
        '01990000-0000-7000-8000-000000004411',
        1,
        19,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        NULL,
        (SELECT id FROM dart_zones WHERE implementation_key = 'MISS'),
        0,
        NULL,
        NULL,
        now()
    ),
    (
        -- GUEST turn 1's dart.
        '01990000-0000-7000-8000-000000004422',
        '01990000-0000-7000-8000-000000004413',
        1,
        19,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        19,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        19,
        -5.00,
        -5.00,
        now()
    ),
    (
        -- DARTBOT turn 1's dart.
        '01990000-0000-7000-8000-000000004423',
        '01990000-0000-7000-8000-000000004414',
        1,
        25,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        25,
        (SELECT id FROM dart_zones WHERE implementation_key = 'SINGLE'),
        25,
        40.00,
        40.00,
        now()
    );

-- ------------------------------------------------------------
-- Step 1: a VISUAL_BOARD dart's location_x/location_y come back
-- unchanged.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'VISUAL_BOARD dart location_x/location_y come back unchanged',
    CASE
        WHEN location_x = 12.34 AND location_y = -56.78 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('location_x=%s location_y=%s (expected 12.34/-56.78)', location_x, location_y)
FROM v_game_replay
WHERE session_id = '01990000-0000-7000-8000-000000004403'
    AND participant_type_key = 'PLAYER'
    AND turn_sequence = 1;

-- ------------------------------------------------------------
-- Step 2: a bounce-out dart returns NULL for both location
-- columns (the dart row itself is still present).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'Bounce-out dart returns NULL for both location columns',
    CASE
        WHEN dart_number IS NOT NULL
            AND location_x IS NULL
            AND location_y IS NULL
        THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('dart_number=%s location_x=%s location_y=%s', dart_number, location_x, location_y)
FROM v_game_replay
WHERE session_id = '01990000-0000-7000-8000-000000004403'
    AND participant_type_key = 'PLAYER'
    AND turn_sequence = 2;

-- ------------------------------------------------------------
-- Step 3: a turn-total-only turn (no dart rows at all) returns
-- one row with every dart column NULL and a non-null
-- participant_id.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    'Turn-total-only turn returns one row with NULL dart columns and a non-null participant_id',
    CASE
        WHEN count(*) = 1
            AND bool_and(dart_number IS NULL)
            AND bool_and(location_x IS NULL)
            AND bool_and(location_y IS NULL)
            AND bool_and(participant_id IS NOT NULL)
        THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s row(s); dart_number=%s participant_id=%s', count(*), max(dart_number), max(participant_id::text))
FROM v_game_replay
WHERE session_id = '01990000-0000-7000-8000-000000004403'
    AND participant_type_key = 'PLAYER'
    AND turn_sequence = 3;

-- ------------------------------------------------------------
-- Step 4: PLAYER, GUEST and DARTBOT each appear with their own
-- participant_type_key for the same session.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4',
    'PLAYER, GUEST and DARTBOT participants each appear with their participant_type_key',
    CASE
        WHEN types.agg = ARRAY['DARTBOT', 'GUEST', 'PLAYER'] THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('found participant_type_key(s): %s', types.agg)
FROM (
        SELECT array_agg(
                DISTINCT participant_type_key
                ORDER BY participant_type_key
            ) AS agg
        FROM v_game_replay
        WHERE session_id = '01990000-0000-7000-8000-000000004403'
    ) types;

-- ------------------------------------------------------------
-- Step 5: the widening adds columns, never rows. Row count for
-- the fixture session must equal an inline CTE reproducing the
-- pre-0044 (0016) select list and join graph verbatim.
-- ------------------------------------------------------------
WITH legacy_replay AS (
    SELECT es.id AS session_id,
        es.player_id,
        st.id                  AS stage_id,
        st.parent_stage_id,
        st.sequence_number     AS stage_sequence,
        stg.implementation_key AS stage_type_key,
        t.sequence_number      AS turn_sequence,
        p.display_name         AS participant_name,
        t.total_score          AS turn_total_score,
        d.dart_number,
        d.intended_target_number,
        dz1.implementation_key AS intended_zone_key,
        d.hit_target_number,
        dz2.implementation_key AS hit_zone_key,
        d.score
    FROM exercise_sessions es
        JOIN exercise_stages st ON st.exercise_session_id = es.id
        JOIN stage_types stg    ON stg.id = st.stage_type_id
        JOIN turns t            ON t.exercise_stage_id = st.id
        JOIN participants p     ON p.id = t.participant_id
        LEFT JOIN darts d        ON d.turn_id = t.id
        LEFT JOIN dart_zones dz1 ON dz1.id = d.intended_zone_id
        LEFT JOIN dart_zones dz2 ON dz2.id = d.hit_zone_id
    WHERE es.id = '01990000-0000-7000-8000-000000004403'
)
INSERT INTO verification_results
SELECT '5',
    'v_game_replay row count for the fixture session equals the pre-0044 (0016) join graph -- widening adds columns, never rows',
    CASE WHEN widened.row_count = legacy.row_count THEN 'PASS' ELSE 'FAIL' END,
    format('widened=%s legacy=%s', widened.row_count, legacy.row_count)
FROM (
        SELECT count(*) AS row_count
        FROM v_game_replay
        WHERE session_id = '01990000-0000-7000-8000-000000004403'
    ) widened,
    (SELECT count(*) AS row_count FROM legacy_replay) legacy;

-- ------------------------------------------------------------
-- Anti-vacuity guard: several checks above are driven by a
-- SELECT against a view, so a broken column could make one
-- vanish silently instead of failing. Assert the count of checks
-- that actually ran separately (D192).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '6',
    'all 5 view-driven checks actually ran',
    CASE
        WHEN count(*) = 5 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 5 checks ran', count(*))
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
