-- ============================================================
-- Migration: 0055_x01_checkout_darts_coordinates.sql
--
-- Purpose:
-- Widen v_x01_checkout_darts with each dart's landing
-- coordinates, so the application read layer can fold the
-- aim a thrower was most plausibly pointing at from where the
-- dart actually landed.
--
-- Facts only: location_x / location_y are darts' own columns
-- (0017), already reached by this view's FROM darts -- the
-- widening reads them, it adds no join and no row. An inferred
-- aim is derived in the application and never stored.
--
-- The up direction uses CREATE OR REPLACE: the two new columns
-- land after the existing 18, so no column is dropped or
-- reordered. CREATE OR REPLACE cannot drop columns back off, so
-- the down direction DROPs the view and recreates 0039's
-- definition verbatim.
-- ============================================================

-- migrate:up
CREATE OR REPLACE VIEW v_x01_checkout_darts AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    rv.implementation_key AS ruleset_version_key,
    ec.configuration,
    st.id AS stage_id,
    st.sequence_number AS stage_sequence,
    stg.implementation_key AS stage_type_key,
    st.parent_stage_id,
    t.id AS turn_id,
    t.sequence_number AS turn_sequence,
    t.total_score AS turn_total_score,
    t.completed_at AS turn_completed_at,
    t.participant_id,
    d.dart_number,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.score,
    d.location_x,
    d.location_y
FROM darts d
    JOIN turns t ON t.id = d.turn_id
    JOIN participants p ON p.id = t.participant_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN stage_types stg ON stg.id = st.stage_type_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN ruleset_versions rv ON rv.id = es.ruleset_version_id
    JOIN input_modes im ON im.id = es.input_mode_id
    LEFT JOIN exercise_configurations ec ON ec.exercise_session_id = es.id
    LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id
WHERE gt.implementation_key IN ('501', 'TUOD', 'ONE_TWENTY_ONE')
    AND im.implementation_key = 'VISUAL_BOARD'
    AND p.player_id = es.player_id;
COMMENT ON VIEW v_x01_checkout_darts IS 'Per-dart facts plus the stage tree, counted turn total, ruleset version, configuration snapshot and dart landing coordinates (location_x, location_y) for 501/TUOD/121 VISUAL_BOARD sessions (owning player only). Remaining-before-dart is folded in the application read layer, never here.';

-- migrate:down
DROP VIEW IF EXISTS v_x01_checkout_darts;
CREATE VIEW v_x01_checkout_darts AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    rv.implementation_key AS ruleset_version_key,
    ec.configuration,
    st.id AS stage_id,
    st.sequence_number AS stage_sequence,
    stg.implementation_key AS stage_type_key,
    st.parent_stage_id,
    t.id AS turn_id,
    t.sequence_number AS turn_sequence,
    t.total_score AS turn_total_score,
    t.completed_at AS turn_completed_at,
    t.participant_id,
    d.dart_number,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.score
FROM darts d
    JOIN turns t ON t.id = d.turn_id
    JOIN participants p ON p.id = t.participant_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN stage_types stg ON stg.id = st.stage_type_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN ruleset_versions rv ON rv.id = es.ruleset_version_id
    JOIN input_modes im ON im.id = es.input_mode_id
    LEFT JOIN exercise_configurations ec ON ec.exercise_session_id = es.id
    LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id
WHERE gt.implementation_key IN ('501', 'TUOD', 'ONE_TWENTY_ONE')
    AND im.implementation_key = 'VISUAL_BOARD'
    AND p.player_id = es.player_id;
COMMENT ON VIEW v_x01_checkout_darts IS 'Per-dart facts plus the stage tree, counted turn total, ruleset version and configuration snapshot for 501/TUOD/121 VISUAL_BOARD sessions (owning player only). Remaining-before-dart is folded in the application read layer, never here.';
