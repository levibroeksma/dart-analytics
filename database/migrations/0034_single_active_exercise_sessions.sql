-- ============================================================
-- Migration: 0034_single_active_exercise_sessions.sql
--
-- Purpose:
-- Make uq_sessions_single_active cover non-game sessions.
--
-- The index from 0011 keys on (player_id, game_type_id) where
-- completed_at IS NULL. Migration 0029 made game_type_id
-- NULLABLE so a training step could run without a game, and
-- Postgres treats every NULL as distinct for uniqueness, so
-- from 0029 onward the index stopped constraining WARM_UP,
-- SWITCHING and DOUBLE_PATTERN sessions entirely: a retried or
-- duplicated step start inserted a second ACTIVE row for the
-- same player with no DB-level signal (issue #310).
--
-- The rewritten index keys on
-- COALESCE(game_type_id, exercise_type_id): a game session
-- keys on its game type exactly as before, and a non-game
-- session keys on its exercise type. Two different games, or a
-- game and a training step, stay concurrently startable; two
-- open sessions of the same kind do not. Both columns are UUID,
-- so the expression is type-stable and no literal id appears in
-- DDL (0029's rule).
--
-- The backfill closes rows that already violate the new index,
-- keeping the newest started_at per key and marking the rest
-- ABANDONED with completed_at = now(). It is NOT reversed by
-- migrate:down: a status transition is a fact, and 0011's index
-- is satisfied by the closed rows either way.
-- ============================================================

-- migrate:up
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY player_id, COALESCE(game_type_id, exercise_type_id)
            ORDER BY started_at DESC, id DESC
        ) AS recency
    FROM exercise_sessions
    WHERE completed_at IS NULL
)
UPDATE exercise_sessions
SET status_id = (
        SELECT id FROM game_statuses WHERE implementation_key = 'ABANDONED'
    ),
    completed_at = NOW()
WHERE id IN (SELECT id FROM ranked WHERE recency > 1);

DROP INDEX IF EXISTS uq_sessions_single_active;

CREATE UNIQUE INDEX uq_sessions_single_active ON exercise_sessions (
    player_id, COALESCE(game_type_id, exercise_type_id)
)
WHERE completed_at IS NULL;

COMMENT ON INDEX uq_sessions_single_active IS 'One open session per player per game type, or per exercise type when no game is bound.';

-- migrate:down
DROP INDEX IF EXISTS uq_sessions_single_active;

CREATE UNIQUE INDEX uq_sessions_single_active ON exercise_sessions (player_id, game_type_id)
WHERE completed_at IS NULL;
