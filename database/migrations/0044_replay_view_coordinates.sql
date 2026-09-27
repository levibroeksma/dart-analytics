-- ============================================================
-- Migration: 0044_replay_view_coordinates.sql
--
-- Purpose:
-- Widen v_game_replay so a replay reader can resolve which
-- participant a turn belongs to and where each dart landed.
--
-- Widened in place rather than adding a sibling view: nothing in
-- app/ reads v_game_replay yet, and 0023_owner_scoped_dart_views's
-- verification counts v_game_replay's rows for a session to prove
-- the view is deliberately NOT owner-scoped -- a widening keeps
-- that row count exact, a sibling view would never exercise it.
-- The view stays unfiltered by participant, per that same rule.
--
-- No context_key: that is a session fact, derived once in
-- v_stats_session_facts (0043), not a per-turn/per-dart fact this
-- view has any business repeating. D371 (recorded in phase 5b).
--
-- participant_id and participant_type_key come from a new JOIN to
-- participant_types -- participant_type_id is a NOT NULL FK to a
-- single lookup row, so no fan-out. location_x/location_y are
-- darts' own columns (0017), already reached by 0016's LEFT JOIN
-- to darts -- the widening reads them, it does not add a join.
--
-- The up direction uses CREATE OR REPLACE: the four new columns
-- land after the existing 15, so no column is dropped or
-- reordered. CREATE OR REPLACE cannot drop columns back off, so
-- the down direction instead DROPs the view and recreates 0016's
-- definition verbatim.
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
    d.score
FROM exercise_sessions es
    JOIN exercise_stages st ON st.exercise_session_id = es.id
    JOIN stage_types stg    ON stg.id = st.stage_type_id
    JOIN turns t            ON t.exercise_stage_id = st.id
    JOIN participants p     ON p.id = t.participant_id
    LEFT JOIN darts d        ON d.turn_id = t.id
    LEFT JOIN dart_zones dz1 ON dz1.id = d.intended_zone_id
    LEFT JOIN dart_zones dz2 ON dz2.id = d.hit_zone_id;
COMMENT ON VIEW v_game_replay IS 'Reconstructs chronological gameplay events at turn resolution (dart columns NULL for turn-total-only turns).';
