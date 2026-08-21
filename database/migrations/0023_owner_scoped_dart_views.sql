-- ============================================================
-- Restrict v_dart_analytics and v_dart_locations to the
-- session owner's OWN participant.
--
-- Guest participants (participant_types GUEST) throw into the
-- same turns/darts tables as the owning player. Both views
-- project es.player_id, so before this migration a guest's
-- darts were counted as the owner's in every accuracy read.
--
-- Behaviour-preserving for every existing single-participant
-- session: those sessions have exactly one participant, and it
-- is the PLAYER whose player_id equals es.player_id.
--
-- v_game_replay is deliberately NOT filtered: it exists to
-- replay a session as it was played, participants included.
--
-- Never edits 0009/0013/0014/0018.
-- ============================================================

-- migrate:up
DROP VIEW IF EXISTS v_dart_analytics;
CREATE VIEW v_dart_analytics AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    d.intended_target_number,
    intended_zone.implementation_key AS intended_zone_key,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.score,
    CASE
        WHEN d.intended_target_number = d.hit_target_number
        AND d.intended_zone_id = d.hit_zone_id THEN TRUE
        ELSE FALSE
    END AS exact_hit
FROM darts d
    JOIN turns t             ON t.id = d.turn_id
    JOIN participants p      ON p.id = t.participant_id
    JOIN exercise_stages st  ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt       ON gt.id = es.game_type_id
    LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id
    LEFT JOIN dart_zones hit_zone      ON hit_zone.id = d.hit_zone_id
WHERE d.intended_target_number IS NOT NULL
    AND d.intended_zone_id IS NOT NULL
    AND p.player_id = es.player_id;
COMMENT ON VIEW v_dart_analytics IS 'Dataset for dart accuracy analytics (session-scoped, owning player only).';

DROP VIEW IF EXISTS v_dart_locations;
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
    JOIN participants p ON p.id = t.participant_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN input_modes im ON im.id = es.input_mode_id
    LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id
    LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id
WHERE d.location_x IS NOT NULL
    AND d.location_y IS NOT NULL
    AND p.player_id = es.player_id;
COMMENT ON VIEW v_dart_locations IS 'Dart landing coordinates in millimetres with derived polar form (owning player only); miss margin is computed in the application read layer.';

-- migrate:down
DROP VIEW IF EXISTS v_dart_analytics;
CREATE VIEW v_dart_analytics AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    d.intended_target_number,
    intended_zone.implementation_key AS intended_zone_key,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.score,
    CASE
        WHEN d.intended_target_number = d.hit_target_number
        AND d.intended_zone_id = d.hit_zone_id THEN TRUE
        ELSE FALSE
    END AS exact_hit
FROM darts d
    JOIN turns t             ON t.id = d.turn_id
    JOIN exercise_stages st  ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt       ON gt.id = es.game_type_id
    LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id
    LEFT JOIN dart_zones hit_zone      ON hit_zone.id = d.hit_zone_id
WHERE d.intended_target_number IS NOT NULL
    AND d.intended_zone_id IS NOT NULL;
COMMENT ON VIEW v_dart_analytics IS 'Dataset for dart accuracy analytics (session-scoped).';

DROP VIEW IF EXISTS v_dart_locations;
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
