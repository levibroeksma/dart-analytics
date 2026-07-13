-- ============================================================
-- Migration: 0014_dart_analytics_session_scope.sql
--
-- Purpose:
-- Add session_id to v_dart_analytics so the per-session darts
-- endpoint (GET /api/sessions/:sessionId/darts) can filter by
-- session through the view. player_id is retained for future
-- player-global statistics.
--
-- Behaviour-preserving: same rows, joins and filter as 0013;
-- only the projection gains session_id. Never edits 0013/0009.
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
    JOIN exercise_stages st  ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt       ON gt.id = es.game_type_id
    LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id
    LEFT JOIN dart_zones hit_zone      ON hit_zone.id = d.hit_zone_id
WHERE d.intended_target_number IS NOT NULL
    AND d.intended_zone_id IS NOT NULL;
COMMENT ON VIEW v_dart_analytics IS 'Dataset for dart accuracy analytics (session-scoped).';

-- migrate:down
DROP VIEW IF EXISTS v_dart_analytics;
CREATE VIEW v_dart_analytics AS
SELECT es.player_id,
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
COMMENT ON VIEW v_dart_analytics IS 'Dataset for dart accuracy analytics.';
