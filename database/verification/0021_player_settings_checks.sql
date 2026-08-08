-- ============================================================
-- Verification: 0021_player_settings_checks.sql
--
-- Runs task-7-brief.md's Step 2 as assertions against a live
-- database, since no PostgreSQL server exists in the container
-- that authored migrations/0021_player_settings_read_model.sql
-- (D193 — SQL that cannot be applied locally ships with a
-- verification script the owner runs against the real Neon
-- database before merge):
--
--   1. v_player_settings exists as a view and exposes exactly
--      (player_id, default_capture_mode_key,
--      default_input_mode_key, updated_at), in that order
--   2. a player_settings row with known mode ids resolves to
--      the corresponding implementation_key values, not ids
--   3. a player with no player_settings row produces no
--      v_player_settings row (the service applies defaults;
--      the view does not invent them)
--   4. a player_settings row whose mode ids are both NULL
--      still yields a view row (the LEFT JOIN this view is
--      built on), with NULL keys rather than the row
--      vanishing — an INNER JOIN would pass every other check
--      here but fail this one
--
-- Everything runs inside one transaction that ends in
-- ROLLBACK, so no fixture row survives. Lookup rows are
-- resolved by implementation_key, never by hardcoded id.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0021_player_settings_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:migrate` has applied migration 0021.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Fixture: three players.
--
-- A has a player_settings row with known, non-NULL mode ids
--   (step 2).
-- B has no player_settings row at all (step 3).
-- C has a player_settings row whose mode ids are both NULL
--   (step 4) — the case only a LEFT JOIN survives.
-- ------------------------------------------------------------
INSERT INTO players (id, auth_user_id, display_name, created_at, updated_at)
VALUES (
        '01990000-0000-7000-8000-00000000e001',
        'verification-0021-a',
        'Verification Fixture A',
        now(),
        now()
    ),
    (
        '01990000-0000-7000-8000-00000000e002',
        'verification-0021-b',
        'Verification Fixture B',
        now(),
        now()
    ),
    (
        '01990000-0000-7000-8000-00000000e003',
        'verification-0021-c',
        'Verification Fixture C',
        now(),
        now()
    );

INSERT INTO player_settings (
        player_id,
        default_capture_mode_id,
        default_input_mode_id,
        created_at,
        updated_at
    )
VALUES (
        '01990000-0000-7000-8000-00000000e001',
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
        now(),
        now()
    ),
    (
        -- Player C: a settings row whose mode ids are both NULL.
        -- Step 4 asserts the LEFT JOIN still yields a row for it,
        -- with NULL keys. An INNER JOIN would drop it and pass
        -- every other check in this file. Player B is the absent
        -- case and deliberately gets no row here at all.
        '01990000-0000-7000-8000-00000000e003',
        NULL,
        NULL,
        now(),
        now()
    );

-- ------------------------------------------------------------
-- Step 1: v_player_settings exists as a view.
--
-- Checked separately from the column check below, so a view
-- that was dropped/renamed fails here rather than the column
-- check silently reporting zero columns as a mismatch with an
-- unhelpful detail.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'v_player_settings exists as a view',
    CASE
        WHEN count(*) = 1 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s matching information_schema.views row(s) found', count(*))
FROM information_schema.views
WHERE table_schema = 'public'
    AND table_name = 'v_player_settings';

-- ------------------------------------------------------------
-- Step 1 (continued): exactly the four expected columns, in
-- the expected order.
--
-- A view that exists but exposes the wrong column set (e.g. a
-- leftover id column, or keys in the wrong order) must FAIL
-- here even though the existence check above passed.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'v_player_settings exposes exactly (player_id, default_capture_mode_key, default_input_mode_key, updated_at) in order',
    CASE
        WHEN cols.names = ARRAY['player_id', 'default_capture_mode_key', 'default_input_mode_key', 'updated_at'] THEN 'PASS'
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
            AND table_name = 'v_player_settings'
    ) cols;

-- ------------------------------------------------------------
-- Step 2: a known settings row translates ids to keys.
--
-- This is the view's whole job. Driven by a SELECT against the
-- view filtered to player A, so a missing row (e.g. a broken
-- join) would insert nothing here rather than a FAIL row — the
-- anti-vacuity guard at the end catches that.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'known default_capture_mode_id resolves to implementation_key ANALYTICS',
    CASE
        WHEN default_capture_mode_key = 'ANALYTICS' THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('got %s', default_capture_mode_key)
FROM v_player_settings
WHERE player_id = '01990000-0000-7000-8000-00000000e001';

INSERT INTO verification_results
SELECT '2',
    'known default_input_mode_id resolves to implementation_key VISUAL_BOARD',
    CASE
        WHEN default_input_mode_key = 'VISUAL_BOARD' THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('got %s', default_input_mode_key)
FROM v_player_settings
WHERE player_id = '01990000-0000-7000-8000-00000000e001';

-- ------------------------------------------------------------
-- Step 3: a player with no player_settings row has no
-- v_player_settings row either. The service applies the
-- RECREATIONAL + QUICK_SCORE defaults; the view must not.
--
-- Uses a bare count(*), which always returns exactly one
-- aggregate row regardless of match count, so this check
-- cannot vanish the way a non-aggregate SELECT could.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    'player with no player_settings row produces no v_player_settings row',
    CASE
        WHEN count(*) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s row(s) returned', count(*))
FROM v_player_settings
WHERE player_id = '01990000-0000-7000-8000-00000000e002';

-- ------------------------------------------------------------
-- Step 4: the LEFT JOIN's whole reason for existing.
--
-- Player C's player_settings row has both mode ids NULL. An
-- INNER JOIN (or a LEFT JOIN accidentally written as an inner
-- one) would drop this row entirely and pass every other check
-- in this file; only this step catches it.
--
-- Same bare-count(*) technique as step 3, so a vanished row
-- (the INNER JOIN failure mode) reads as an explicit FAIL
-- rather than as a missing result row.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4',
    'settings row with NULL mode ids still yields a view row (LEFT JOIN)',
    CASE
        WHEN count(*) = 1 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s row(s) returned', count(*))
FROM v_player_settings
WHERE player_id = '01990000-0000-7000-8000-00000000e003';

INSERT INTO verification_results
SELECT '4',
    'NULL mode ids yield NULL keys rather than defaulted keys',
    CASE
        WHEN default_capture_mode_key IS NULL
        AND default_input_mode_key IS NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    format(
        'capture=%s input=%s',
        default_capture_mode_key,
        default_input_mode_key
    )
FROM v_player_settings
WHERE player_id = '01990000-0000-7000-8000-00000000e003';

-- ------------------------------------------------------------
-- Anti-vacuity guard: several checks above are driven by a
-- SELECT against the view, so a broken join could make one
-- vanish silently instead of failing. Assert the count of
-- checks that actually ran separately (D192).
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '5',
    'all 7 checks actually ran',
    CASE
        WHEN count(*) = 7 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 7 checks ran', count(*))
FROM verification_results
WHERE step IN ('1', '2', '3', '4');

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
