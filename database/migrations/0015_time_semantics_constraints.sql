-- ============================================================
-- Migration: 0015_time_semantics_constraints.sql
--
-- Purpose:
-- Align time-related constraints with the batch write model.
--
-- created_at is row persistence time (server clock) on every
-- table. Gameplay chronology comes from sequence numbers and
-- client-observed timestamps (turns.completed_at), never from
-- created_at. Under batch upload at session completion, a
-- turn's client-observed completed_at legitimately predates
-- the row insert, so chk_turn_completed_after_created must go.
--
-- Also replaces the players display-name check: the
-- "display_name IS NULL" arm was dead code against a
-- NOT NULL column.
-- ============================================================

-- migrate:up
ALTER TABLE turns
DROP CONSTRAINT chk_turn_completed_after_created;

ALTER TABLE players
DROP CONSTRAINT chk_players_display_name_not_empty;

ALTER TABLE players
ADD CONSTRAINT chk_players_display_name_not_empty CHECK (length(trim(display_name)) > 0);

-- migrate:down
ALTER TABLE players
DROP CONSTRAINT chk_players_display_name_not_empty;

ALTER TABLE players
ADD CONSTRAINT chk_players_display_name_not_empty CHECK (
        display_name IS NULL
        OR length(trim(display_name)) > 0
    );

ALTER TABLE turns
ADD CONSTRAINT chk_turn_completed_after_created CHECK (
        completed_at IS NULL
        OR completed_at >= created_at
    );
