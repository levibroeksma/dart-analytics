-- ============================================================
-- Migration: 0053_replay_view_kept.sql
--
-- Purpose:
-- Widen v_game_replay with turns.kept (0051), so a replay reader
-- rebuilds a Follow the Leader keep as the leader's dartless keep
-- rather than an empty visit. Without it a stored keep replays as
-- a re-thrown setting dart and the rebuilt active seat and phase
-- go wrong from that turn on.
--
-- kept is the turn's own column, already reached by the existing
-- JOIN to turns -- no new join, no fan-out, row count unchanged.
-- The view stays unfiltered by participant (0023).
--
-- The up direction uses CREATE OR REPLACE: kept lands after the
-- existing 19 columns, so none is dropped or reordered. CREATE OR
-- REPLACE cannot drop a column back off, so the down direction
-- DROPs the view and recreates 0044's definition verbatim.
-- ============================================================

-- migrate:up
CREATE OR REPLACE VIEW v_game_replay AS
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
    d.score,
    p.id                   AS participant_id,
    pt.implementation_key  AS participant_type_key,
    d.location_x,
    d.location_y,
    t.kept
FROM exercise_sessions es
    JOIN exercise_stages st    ON st.exercise_session_id = es.id
    JOIN stage_types stg       ON stg.id = st.stage_type_id
    JOIN turns t               ON t.exercise_stage_id = st.id
    JOIN participants p        ON p.id = t.participant_id
    JOIN participant_types pt  ON pt.id = p.participant_type_id
    LEFT JOIN darts d          ON d.turn_id = t.id
    LEFT JOIN dart_zones dz1   ON dz1.id = d.intended_zone_id
    LEFT JOIN dart_zones dz2   ON dz2.id = d.hit_zone_id;
COMMENT ON VIEW v_game_replay IS 'Reconstructs chronological gameplay events at turn resolution (dart columns NULL for turn-total-only turns); carries participant identity (participant_id, participant_type_key), dart landing coordinates (location_x, location_y) and the turn''s kept flag (kept).';

-- migrate:down
DROP VIEW v_game_replay;
CREATE VIEW v_game_replay AS
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
    d.score,
    p.id                   AS participant_id,
    pt.implementation_key  AS participant_type_key,
    d.location_x,
    d.location_y
FROM exercise_sessions es
    JOIN exercise_stages st    ON st.exercise_session_id = es.id
    JOIN stage_types stg       ON stg.id = st.stage_type_id
    JOIN turns t               ON t.exercise_stage_id = st.id
    JOIN participants p        ON p.id = t.participant_id
    JOIN participant_types pt  ON pt.id = p.participant_type_id
    LEFT JOIN darts d          ON d.turn_id = t.id
    LEFT JOIN dart_zones dz1   ON dz1.id = d.intended_zone_id
    LEFT JOIN dart_zones dz2   ON dz2.id = d.hit_zone_id;
COMMENT ON VIEW v_game_replay IS 'Reconstructs chronological gameplay events at turn resolution (dart columns NULL for turn-total-only turns); carries participant identity (participant_id, participant_type_key) and dart landing coordinates (location_x, location_y).';
