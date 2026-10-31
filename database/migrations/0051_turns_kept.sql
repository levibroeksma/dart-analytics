-- ============================================================
-- Migration: 0051_turns_kept.sql
--
-- Purpose:
-- A turn can be kept: a Follow the Leader visit that matched the
-- leader's lead and stays in play. The fact is stored on the turn;
-- what it means (streaks, survival) is derived in views.
--
-- Contains:
-- - turns.kept: BOOLEAN NOT NULL DEFAULT false. Every existing turn
--   and every upload from a client that omits it is not kept.
--
-- No data change, no CHECK.
-- ============================================================

-- migrate:up
ALTER TABLE turns
    ADD COLUMN kept BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN turns.kept IS 'Fact: the visit matched the leader and stays in play (Follow the Leader). Default false for every other game and for a client that omits it (0051).';

-- migrate:down
ALTER TABLE turns
    DROP COLUMN kept;
