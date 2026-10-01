-- database/seeds/0032_close_finished_game_activities.sql
--
-- ============================================================
-- Seed: 0032_close_finished_game_activities.sql
--
-- Purpose:
-- Backfill the terminal state of standalone game activities.
-- Until the session service closed the activity with its
-- session, every finished game left its activities row ACTIVE
-- with completed_at NULL. This copies the session's terminal
-- status and completed_at onto that activity. Idempotent: only
-- rows still open are touched, so re-running is a no-op.
--
-- Scope: an open activity with no activity_configurations
-- snapshot (a standalone game, not a training routine) whose
-- single session has finished. A session still in progress
-- leaves its activity open.
-- ============================================================
BEGIN;

UPDATE activities a
SET status_id = s.status_id,
    completed_at = s.completed_at
FROM exercise_sessions s
WHERE s.activity_id = a.id
    AND a.completed_at IS NULL
    AND s.completed_at IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM activity_configurations ac
        WHERE ac.activity_id = a.id
    )
    AND (
        SELECT count(*)
        FROM exercise_sessions o
        WHERE o.activity_id = a.id
    ) = 1;

COMMIT;
