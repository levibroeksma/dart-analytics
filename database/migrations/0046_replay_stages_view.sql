-- ============================================================
-- Migration: 0046_replay_stages_view.sql
--
-- Purpose:
-- Stage-grain read model for the replay's stage tree: one row per
-- exercise stage of a session, whether or not it holds a turn.
--
-- The replay used to derive its stage tree from v_game_replay,
-- which inner-joins turns, so a parent stage with no turns of its
-- own (SET -> LEG with turns only on legs) had no row and its
-- children named a parent missing from the list (issue #639).
-- Reading the tree from the stage table removes that dependency;
-- nothing turn-shaped is selected here.
--
-- Owner-scoped like the other read models: player_id comes from
-- exercise_sessions, callers filter by it. v_game_replay keeps
-- serving the turn and dart rows unchanged.
-- ============================================================

-- migrate:up
CREATE VIEW v_replay_stages AS
SELECT es.id AS session_id,
    es.player_id,
    st.id                  AS stage_id,
    st.parent_stage_id,
    st.sequence_number     AS stage_sequence,
    stg.implementation_key AS stage_type_key
FROM exercise_sessions es
    JOIN exercise_stages st ON st.exercise_session_id = es.id
    JOIN stage_types stg    ON stg.id = st.stage_type_id;
COMMENT ON VIEW v_replay_stages IS 'One row per exercise stage of a session, turns or not; the replay stage tree. Filter by player_id and session_id.';

-- migrate:down
DROP VIEW IF EXISTS v_replay_stages;
