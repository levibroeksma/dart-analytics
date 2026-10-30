-- ============================================================
-- Migration: 0052_turns_kept_comment.sql
--
-- Purpose:
-- Correct the meaning recorded on turns.kept. A kept turn is the
-- Follow the Leader LEADER's dartless keep: when every other seat
-- failed the target, the leader keeps it unchanged instead of
-- throwing. A kept turn has no darts and total_score 0.
--
-- Supersedes the column comment written by 0051_turns_kept.sql,
-- which described a kept turn as a visit that matched the leader.
-- 0051 is left untouched (applied-migration rule); this file
-- replaces its comment only.
--
-- Contains:
-- - COMMENT ON COLUMN turns.kept (corrected).
--
-- No column, data, constraint or view change. The down direction
-- restores 0051's comment text verbatim.
-- ============================================================

-- migrate:up
COMMENT ON COLUMN turns.kept IS 'Fact: the leader kept the target unchanged without throwing, because every other seat failed it (Follow the Leader). A kept turn has no darts and total_score 0. Default false for every other turn, every other game and a client that omits it (0051, comment corrected in 0052).';

-- migrate:down
COMMENT ON COLUMN turns.kept IS 'Fact: the visit matched the leader and stays in play (Follow the Leader). Default false for every other game and for a client that omits it (0051).';
