-- ============================================================
-- Migration: 0018_dart_location_read_model.sql
--
-- Purpose:
-- Expose dart landing coordinates for spatial analysis.
--
-- radius_mm and angle_degrees are plain arithmetic over the
-- stored coordinate — no board geometry lives here. Miss
-- margin needs a zone centroid, which is board geometry, so it
-- is derived in the application read layer from the same
-- board-geometry module the client and Worker use. A second
-- copy in SQL would drift from the classifier.
--
-- angle_degrees is the clockwise bearing from the upward
-- vertical, matching the classifier's sector convention.
-- ============================================================

-- migrate:up
CREATE VIEW v_dart_locations AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    im.implementation_key AS input_mode_key,
    st.id AS stage_id,
    t.sequence_number AS turn_sequence,
    t.total_score AS turn_total_score,
    d.dart_number,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.intended_target_number,
    intended_zone.implementation_key AS intended_zone_key,
    d.score,
    d.location_x,
    d.location_y,
    SQRT(
        POWER(d.location_x, 2) + POWER(d.location_y, 2)
    ) AS radius_mm,
    MOD(
        DEGREES(
            ATAN2(d.location_x, - d.location_y)
        )::NUMERIC + 360,
        360
    ) AS angle_degrees
FROM darts d
    JOIN turns t ON t.id = d.turn_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN input_modes im ON im.id = es.input_mode_id
    LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id
    LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id
WHERE d.location_x IS NOT NULL
    AND d.location_y IS NOT NULL;

COMMENT ON VIEW v_dart_locations IS 'Dart landing coordinates in millimetres with derived polar form; miss margin is computed in the application read layer.';

-- migrate:down
DROP VIEW IF EXISTS v_dart_locations;
