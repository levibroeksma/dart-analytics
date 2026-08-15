-- ============================================================
-- Verification: 0022_player_profile_checks.sql
--
-- Runs assertions against a live database, since no PostgreSQL
-- server exists in the container that authored
-- migrations/0022_player_profile_read_model.sql (D193 — SQL
-- that cannot be applied locally ships with a verification
-- script the owner runs against the real Neon database before
-- merge):
--
--   1. v_player_profile exists as a view and exposes exactly
--      (player_id, display_name, darts_description,
--      darts_weight_grams, updated_at), in that order
--   2. a player with darts_description/darts_weight_grams set
--      resolves both through the view
--   3. a player who never set darts equipment resolves both
--      columns as NULL through the view, not defaulted
--   4. chk_players_darts_description_not_empty rejects an
--      empty string, accepts a non-empty string, accepts NULL
--   5. chk_players_darts_weight_grams_range rejects 0 and 101,
--      accepts 1 and 100, accepts NULL
--
-- No seeded lookup table is involved here — unlike the
-- settings/capability checks, darts_description and
-- darts_weight_grams are plain player-owned columns, not FK-
-- backed, so nothing in this file resolves by
-- implementation_key.
--
-- Everything runs inside one transaction that ends in
-- ROLLBACK, so no fixture row survives.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0022_player_profile_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0022.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Fixture: two players.
--
-- A has darts_description and darts_weight_grams set
--   (step 2).
-- B has never set either (step 3) — the default, unconfigured
--   state.
-- ------------------------------------------------------------
INSERT INTO players (
        id,
        auth_user_id,
        display_name,
        darts_description,
        darts_weight_grams,
        created_at,
        updated_at
    )
VALUES (
        '01990000-0000-7000-8000-000000f22a01',
        'verification-0022-a',
        'Verification Fixture A',
        'Winmau Pro-Series 23g',
        23,
        now(),
        now()
    );

INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES (
        '01990000-0000-7000-8000-000000f22a02',
        'verification-0022-b',
        'Verification Fixture B',
        now(),
        now()
    );

-- ------------------------------------------------------------
-- Step 1: v_player_profile exists as a view.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'v_player_profile exists as a view',
    CASE
        WHEN count(*) = 1 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s matching information_schema.views row(s) found', count(*))
FROM information_schema.views
WHERE table_schema = 'public'
    AND table_name = 'v_player_profile';

-- ------------------------------------------------------------
-- Step 1 (continued): exactly the five expected columns, in
-- the expected order.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'v_player_profile exposes exactly (player_id, display_name, darts_description, darts_weight_grams, updated_at) in order',
    CASE
        WHEN cols.names = ARRAY['player_id', 'display_name', 'darts_description', 'darts_weight_grams', 'updated_at'] THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('found column order: %s', cols.names)
FROM (
        SELECT array_agg(
                column_name::TEXT
                ORDER BY ordinal_position
            ) AS names
        FROM information_schema.columns
        WHERE table_schema = 'public'
            AND table_name = 'v_player_profile'
    ) cols;

-- ------------------------------------------------------------
-- Step 2: a configured player's darts resolve through the
-- view.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'darts_description resolves through the view',
    CASE
        WHEN darts_description = 'Winmau Pro-Series 23g' THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('got %s', darts_description)
FROM v_player_profile
WHERE player_id = '01990000-0000-7000-8000-000000f22a01';

INSERT INTO verification_results
SELECT '2',
    'darts_weight_grams resolves through the view',
    CASE
        WHEN darts_weight_grams = 23 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('got %s', darts_weight_grams)
FROM v_player_profile
WHERE player_id = '01990000-0000-7000-8000-000000f22a01';

-- ------------------------------------------------------------
-- Step 3: an unconfigured player's darts read as NULL, not
-- defaulted.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    'unconfigured player reads darts_description/darts_weight_grams as NULL',
    CASE
        WHEN darts_description IS NULL
        AND darts_weight_grams IS NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    format(
        'description=%s weight=%s',
        darts_description,
        darts_weight_grams
    )
FROM v_player_profile
WHERE player_id = '01990000-0000-7000-8000-000000f22a02';

-- ------------------------------------------------------------
-- Step 4: chk_players_darts_description_not_empty. Each
-- attempt runs in its own savepoint so a rejection does not
-- abort the surrounding transaction.
-- ------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        UPDATE players
        SET darts_description = ''
        WHERE id = '01990000-0000-7000-8000-000000f22a02';
        INSERT INTO verification_results VALUES
            ('4', 'empty darts_description is rejected', 'FAIL', 'update was accepted');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('4', 'empty darts_description is rejected', 'PASS', SQLERRM);
    END;

    BEGIN
        UPDATE players
        SET darts_description = 'Target Agora 23g'
        WHERE id = '01990000-0000-7000-8000-000000f22a02';
        INSERT INTO verification_results VALUES
            ('4', 'non-empty darts_description is accepted', 'PASS', NULL);
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('4', 'non-empty darts_description is accepted', 'FAIL', SQLERRM);
    END;

    BEGIN
        UPDATE players
        SET darts_description = NULL
        WHERE id = '01990000-0000-7000-8000-000000f22a02';
        INSERT INTO verification_results VALUES
            ('4', 'NULL darts_description is accepted', 'PASS', NULL);
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('4', 'NULL darts_description is accepted', 'FAIL', SQLERRM);
    END;
END $$;

-- ------------------------------------------------------------
-- Step 5: chk_players_darts_weight_grams_range.
-- ------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        UPDATE players
        SET darts_weight_grams = 0
        WHERE id = '01990000-0000-7000-8000-000000f22a02';
        INSERT INTO verification_results VALUES
            ('5', 'weight 0 is rejected', 'FAIL', 'update was accepted');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('5', 'weight 0 is rejected', 'PASS', SQLERRM);
    END;

    BEGIN
        UPDATE players
        SET darts_weight_grams = 101
        WHERE id = '01990000-0000-7000-8000-000000f22a02';
        INSERT INTO verification_results VALUES
            ('5', 'weight 101 is rejected', 'FAIL', 'update was accepted');
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('5', 'weight 101 is rejected', 'PASS', SQLERRM);
    END;

    BEGIN
        UPDATE players
        SET darts_weight_grams = 1
        WHERE id = '01990000-0000-7000-8000-000000f22a02';
        INSERT INTO verification_results VALUES
            ('5', 'weight 1 is accepted', 'PASS', NULL);
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('5', 'weight 1 is accepted', 'FAIL', SQLERRM);
    END;

    BEGIN
        UPDATE players
        SET darts_weight_grams = 100
        WHERE id = '01990000-0000-7000-8000-000000f22a02';
        INSERT INTO verification_results VALUES
            ('5', 'weight 100 is accepted', 'PASS', NULL);
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('5', 'weight 100 is accepted', 'FAIL', SQLERRM);
    END;

    BEGIN
        UPDATE players
        SET darts_weight_grams = NULL
        WHERE id = '01990000-0000-7000-8000-000000f22a02';
        INSERT INTO verification_results VALUES
            ('5', 'NULL weight is accepted', 'PASS', NULL);
    EXCEPTION WHEN check_violation THEN
        INSERT INTO verification_results VALUES
            ('5', 'NULL weight is accepted', 'FAIL', SQLERRM);
    END;
END $$;

-- ------------------------------------------------------------
-- Anti-vacuity guard: several checks above are driven by a
-- SELECT against the view, so a broken column could make one
-- vanish silently instead of failing. Assert the count of
-- checks that actually ran separately (D192).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '6',
    'all view-driven checks actually ran',
    CASE
        WHEN count(*) = 5 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 5 checks ran', count(*))
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
