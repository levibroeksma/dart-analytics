-- ============================================================
-- Migration: 0009_views.sql
--
-- Purpose:
-- Create application read models.
--
-- Views provide a stable query interface
-- between PostgreSQL and the API layer.
--
-- ============================================================
BEGIN;
-- ============================================================
-- ACTIVE SESSIONS
--
-- Purpose:
-- Resume interrupted games.
--
-- Used by:
-- - application startup
-- - browser refresh recovery
--
-- ============================================================
CREATE VIEW v_active_sessions AS
SELECT es.id AS session_id,
    es.player_id,
    es.game_type_id,
    gt.implementation_key AS game_type_key,
    gt.name AS game_type_name,
    es.capture_mode_id,
    cm.implementation_key AS capture_mode_key,
    es.input_mode_id,
    im.implementation_key AS input_mode_key,
    es.ruleset_version_id,
    es.started_at
FROM exercise_sessions es
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN capture_modes cm ON cm.id = es.capture_mode_id
    JOIN input_modes im ON im.id = es.input_mode_id
    JOIN game_statuses gs ON gs.id = es.status_id
WHERE gs.implementation_key = 'ACTIVE';
COMMENT ON VIEW v_active_sessions IS 'Active gameplay sessions available for resume.';
-- ============================================================
-- SESSION OVERVIEW
--
-- Purpose:
-- Display completed games.
--
-- ============================================================
CREATE VIEW v_session_overview AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type,
    gt.name AS game_name,
    gs.implementation_key AS status,
    cm.implementation_key AS capture_mode,
    es.started_at,
    es.completed_at,
    EXTRACT(
        EPOCH
        FROM (
                COALESCE(
                    es.completed_at,
                    now()
                ) - es.started_at
            )
    ) AS duration_seconds
FROM exercise_sessions es
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN game_statuses gs ON gs.id = es.status_id
    JOIN capture_modes cm ON cm.id = es.capture_mode_id;
COMMENT ON VIEW v_session_overview IS 'High level gameplay history overview.';
-- ============================================================
-- GAME REPLAY
--
-- Purpose:
-- Reconstruct exact gameplay sequence.
--
-- ============================================================
CREATE VIEW v_game_replay AS
SELECT es.id AS session_id,
    es.player_id,
    st.sequence_number AS stage_sequence,
    stg.implementation_key AS stage_type,
    t.sequence_number AS turn_sequence,
    p.display_name AS participant,
    d.dart_number,
    d.intended_target_number,
    dz1.implementation_key AS intended_zone,
    d.hit_target_number,
    dz2.implementation_key AS hit_zone,
    d.score
FROM exercise_sessions es
    JOIN exercise_stages st ON st.exercise_session_id = es.id
    JOIN stage_types stg ON stg.id = st.stage_type_id
    JOIN turns t ON t.exercise_stage_id = st.id
    JOIN participants p ON p.id = t.participant_id
    JOIN darts d ON d.turn_id = t.id
    LEFT JOIN dart_zones dz1 ON dz1.id = d.intended_zone_id
    LEFT JOIN dart_zones dz2 ON dz2.id = d.hit_zone_id;
COMMENT ON VIEW v_game_replay IS 'Reconstructs chronological gameplay events.';
-- ============================================================
-- DART ANALYTICS
--
-- Purpose:
-- Analytics-ready dart dataset.
--
-- ============================================================
CREATE VIEW v_dart_analytics AS
SELECT es.player_id,
    gt.implementation_key AS game_type,
    d.intended_target_number,
    intended_zone.implementation_key AS intended_zone,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone,
    d.score,
    CASE
        WHEN d.intended_target_number = d.hit_target_number
        AND d.intended_zone_id = d.hit_zone_id THEN TRUE
        ELSE FALSE
    END AS exact_hit
FROM darts d
    JOIN turns t ON t.id = d.turn_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id
    LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id
WHERE d.intended_target_number IS NOT NULL
    AND d.intended_zone_id IS NOT NULL;
COMMENT ON VIEW v_dart_analytics IS 'Dataset for dart accuracy analytics.';
-- ============================================================
-- ROUTINE EXECUTION
--
-- Purpose:
-- Show ordered routine exercises.
--
-- ============================================================
CREATE VIEW v_routine_execution AS
SELECT rt.id AS routine_id,
    rt.name AS routine_name,
    rs.sequence_number,
    et.id AS exercise_template_id,
    et.name AS exercise_name,
    gt.implementation_key AS game_type,
    rs.duration_value,
    dt.implementation_key AS duration_type
FROM routine_templates rt
    JOIN routine_steps rs ON rs.routine_template_id = rt.id
    JOIN exercise_templates et ON et.id = rs.exercise_template_id
    JOIN game_types gt ON gt.id = et.game_type_id
    JOIN duration_types dt ON dt.id = rs.duration_type_id;
COMMENT ON VIEW v_routine_execution IS 'Ordered routine execution definition.';
COMMIT;