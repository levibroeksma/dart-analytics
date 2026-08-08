-- ============================================================
-- Verification: 0018_visual_board_checks.sql
--
-- Runs operator-checklist steps 3-5 for the visual-board
-- capture core against a live database:
--
--   3. chk_dart_location_pair rejects a half-set coordinate
--   4. v_dart_locations angle_degrees is the clockwise bearing
--      from the upward vertical (0 up, 90 right)
--   5. a busted visit persists total_score = 0 alongside
--      non-zero dart scores
--
-- Everything runs inside one transaction that ends in
-- ROLLBACK, so no fixture row survives. Lookup rows are
-- resolved by implementation_key, never by hardcoded id.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0018_visual_board_checks.sql
--
-- Expected: every result row reads PASS.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Fixture: one VISUAL_BOARD 501 session with two visits.
-- ------------------------------------------------------------
INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES (
        '01990000-0000-7000-8000-00000000f001',
        'verification-0018',
        'Verification Fixture',
        now(),
        now()
    );

INSERT INTO activities (id, player_id, status_id, started_at, created_at)
VALUES (
        '01990000-0000-7000-8000-00000000f002',
        '01990000-0000-7000-8000-00000000f001',
        (
            SELECT id
            FROM game_statuses
            WHERE implementation_key = 'ACTIVE'
        ),
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
VALUES (
        '01990000-0000-7000-8000-00000000f003',
        '01990000-0000-7000-8000-00000000f002',
        '01990000-0000-7000-8000-00000000f001',
        (
            SELECT id
            FROM game_types
            WHERE implementation_key = '501'
        ),
        (
            SELECT id
            FROM capture_modes
            WHERE implementation_key = 'ANALYTICS'
        ),
        (
            SELECT id
            FROM input_modes
            WHERE implementation_key = 'VISUAL_BOARD'
        ),
        (
            SELECT id
            FROM game_statuses
            WHERE implementation_key = 'ACTIVE'
        ),
        (
            SELECT id
            FROM ruleset_versions
            WHERE implementation_key = '501_V1'
        ),
        now(),
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
        '01990000-0000-7000-8000-00000000f004',
        '01990000-0000-7000-8000-00000000f003',
        (
            SELECT id
            FROM participant_types
            WHERE implementation_key = 'PLAYER'
        ),
        '01990000-0000-7000-8000-00000000f001',
        'Verification Fixture',
        now()
    );

INSERT INTO exercise_stages (
        id,
        exercise_session_id,
        parent_stage_id,
        stage_type_id,
        sequence_number,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-00000000f005',
        '01990000-0000-7000-8000-00000000f003',
        NULL,
        (
            SELECT id
            FROM stage_types
            WHERE implementation_key = 'LEG'
        ),
        1,
        now()
    );

-- Visit 1 carries the four cardinal coordinates (step 4).
-- Visit 2 is a busted visit: counted zero, thrown non-zero (step 5).
INSERT INTO turns (
        id,
        exercise_stage_id,
        participant_id,
        sequence_number,
        total_score,
        created_at
    )
VALUES (
        '01990000-0000-7000-8000-00000000f006',
        '01990000-0000-7000-8000-00000000f005',
        '01990000-0000-7000-8000-00000000f004',
        1,
        140,
        now()
    ),
    (
        '01990000-0000-7000-8000-00000000f007',
        '01990000-0000-7000-8000-00000000f005',
        '01990000-0000-7000-8000-00000000f004',
        2,
        0,
        now()
    );

INSERT INTO darts (
        id,
        turn_id,
        dart_number,
        hit_target_number,
        hit_zone_id,
        score,
        location_x,
        location_y,
        created_at
    )
VALUES (
        -- (0, -100): straight up from the bull -> sector 20, angle 0
        '01990000-0000-7000-8000-00000000fa01',
        '01990000-0000-7000-8000-00000000f006',
        1,
        20,
        (
            SELECT id
            FROM dart_zones
            WHERE implementation_key = 'OUTER_SINGLE'
        ),
        20,
        0.00,
        -100.00,
        now()
    ),
    (
        -- (100, 0): straight right -> sector 6, angle 90
        '01990000-0000-7000-8000-00000000fa02',
        '01990000-0000-7000-8000-00000000f006',
        2,
        6,
        (
            SELECT id
            FROM dart_zones
            WHERE implementation_key = 'OUTER_SINGLE'
        ),
        6,
        100.00,
        0.00,
        now()
    ),
    (
        -- (0, 100): straight down -> sector 3, angle 180
        '01990000-0000-7000-8000-00000000fa03',
        '01990000-0000-7000-8000-00000000f006',
        3,
        3,
        (
            SELECT id
            FROM dart_zones
            WHERE implementation_key = 'OUTER_SINGLE'
        ),
        3,
        0.00,
        100.00,
        now()
    ),
    (
        -- (-100, 0): straight left -> sector 11, angle 270
        '01990000-0000-7000-8000-00000000fa04',
        '01990000-0000-7000-8000-00000000f006',
        4,
        11,
        (
            SELECT id
            FROM dart_zones
            WHERE implementation_key = 'OUTER_SINGLE'
        ),
        11,
        -100.00,
        0.00,
        now()
    ),
    (
        -- Coordinate-less dart: must NOT appear in v_dart_locations.
        '01990000-0000-7000-8000-00000000fa05',
        '01990000-0000-7000-8000-00000000f006',
        5,
        1,
        (
            SELECT id
            FROM dart_zones
            WHERE implementation_key = 'SINGLE'
        ),
        1,
        NULL,
        NULL,
        now()
    ),
    (
        -- The busted visit's thrown dart: scores 11 against a turn total of 0.
        '01990000-0000-7000-8000-00000000fa06',
        '01990000-0000-7000-8000-00000000f007',
        1,
        11,
        (
            SELECT id
            FROM dart_zones
            WHERE implementation_key = 'OUTER_SINGLE'
        ),
        11,
        -95.00,
        -12.00,
        now()
    );

-- ------------------------------------------------------------
-- Step 3: chk_dart_location_pair
--
-- A half-set pair must be rejected; both-NULL and both-set must
-- be accepted. Each attempt runs in its own savepoint so a
-- rejection does not abort the surrounding transaction.
-- ------------------------------------------------------------
DO $$
DECLARE
    turn_id CONSTANT UUID := '01990000-0000-7000-8000-00000000f006';
BEGIN
    BEGIN
        INSERT INTO darts (id, turn_id, dart_number, score, location_x, location_y, created_at)
        VALUES ('01990000-0000-7000-8000-00000000fb01', turn_id, 6, 20, 50.00, NULL, now());
        INSERT INTO verification_results VALUES
            ('3', 'x set, y NULL is rejected', 'FAIL', 'insert was accepted');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('3', 'x set, y NULL is rejected', 'PASS', SQLERRM);
    END;

    BEGIN
        INSERT INTO darts (id, turn_id, dart_number, score, location_x, location_y, created_at)
        VALUES ('01990000-0000-7000-8000-00000000fb02', turn_id, 7, 20, NULL, 50.00, now());
        INSERT INTO verification_results VALUES
            ('3', 'y set, x NULL is rejected', 'FAIL', 'insert was accepted');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('3', 'y set, x NULL is rejected', 'PASS', SQLERRM);
    END;

    BEGIN
        INSERT INTO darts (id, turn_id, dart_number, score, location_x, location_y, created_at)
        VALUES ('01990000-0000-7000-8000-00000000fb03', turn_id, 8, 20, NULL, NULL, now());
        INSERT INTO verification_results VALUES
            ('3', 'both NULL is accepted', 'PASS', NULL);
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('3', 'both NULL is accepted', 'FAIL', SQLERRM);
    END;
END $$;

-- ------------------------------------------------------------
-- Step 4: v_dart_locations angle convention
--
-- angle_degrees is the clockwise bearing from the upward
-- vertical. radius_mm is the plain distance from the bull.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4',
    format(
        'dart %s at (%s, %s) reads %s deg',
        dart_number,
        location_x,
        location_y,
        angle_degrees
    ),
    CASE
        WHEN round(angle_degrees) = expected_angle
        AND round(radius_mm) = 100 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format(
        'expected %s deg / 100mm, got %s deg / %s mm',
        expected_angle,
        round(angle_degrees, 2),
        round(radius_mm, 2)
    )
FROM v_dart_locations
    JOIN (
        VALUES (1, 0),
            (2, 90),
            (3, 180),
            (4, 270)
    ) AS expected(dart_number, expected_angle) USING (dart_number)
WHERE session_id = '01990000-0000-7000-8000-00000000f003'
    AND turn_sequence = 1;

-- The four cardinal checks above are driven by a join against the view, so an
-- empty view would insert no rows at all and report a vacuous pass. Assert the
-- count separately.
INSERT INTO verification_results
SELECT '4',
    'all four cardinal darts were actually checked',
    CASE
        WHEN count(*) = 4 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 4 cardinal checks ran', count(*))
FROM verification_results
WHERE step = '4';

-- The coordinate-less dart must be filtered out of the view.
INSERT INTO verification_results
SELECT '4',
    'coordinate-less dart is excluded from the view',
    CASE
        WHEN count(*) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s row(s) returned', count(*))
FROM v_dart_locations
WHERE session_id = '01990000-0000-7000-8000-00000000f003'
    AND dart_number = 5;

-- The view must expose the session's input mode as VISUAL_BOARD.
INSERT INTO verification_results
SELECT '4',
    'input_mode_key is VISUAL_BOARD',
    CASE
        WHEN count(*) = 5
        AND count(*) FILTER (
            WHERE input_mode_key = 'VISUAL_BOARD'
        ) = 5 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of %s rows', count(*) FILTER (WHERE input_mode_key = 'VISUAL_BOARD'), count(*))
FROM v_dart_locations
WHERE session_id = '01990000-0000-7000-8000-00000000f003';

-- ------------------------------------------------------------
-- Step 5: bust divergence
--
-- A busted visit counts zero while its darts scored non-zero.
-- That divergence is the fact D189 depends on.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '5',
    'busted visit keeps total_score = 0 against non-zero darts',
    CASE
        WHEN t.total_score = 0
        AND max(d.score) > 0 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format(
        'total_score = %s, dart scores = %s',
        t.total_score,
        array_agg(
            d.score
            ORDER BY d.dart_number
        )
    )
FROM turns t
    JOIN darts d ON d.turn_id = t.id
WHERE t.id = '01990000-0000-7000-8000-00000000f007'
GROUP BY t.id,
    t.total_score;

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
