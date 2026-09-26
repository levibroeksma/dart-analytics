-- ============================================================
-- Migration: 0043_stats_base_views.sql
--
-- Purpose:
-- Base fact views for the detailed statistics pages
-- (docs/architecture/10-Statistics/00-Overview.md §10, D364).
--
-- v_stats_session_facts: one row per COMPLETED or ABANDONED
-- game session, owner-scoped. Counts are rule-free reductions
-- over the owning participant's turns and darts. context_key is
-- derived, never stored: ROUTINE when the session's activity
-- has an activity_configurations snapshot, else STANDALONE.
-- Turn and dart aggregates are separate LATERAL subqueries so
-- neither fans the other out. COUNT/SUM are cast to integer so
-- node-postgres does not deliver NUMERIC strings.
--
-- v_stats_dart_facts: one row per VISUAL_BOARD dart with
-- coordinates, owner-scoped, carrying the session columns every
-- board/intent section filters on. Consumed from phase 2.
--
-- idx_exercise_sessions_player_game_completed: the date-range
-- entry point every statistics query takes.
-- ============================================================

-- migrate:up
CREATE VIEW v_stats_session_facts AS
SELECT es.id AS session_id,
    es.player_id,
    es.activity_id,
    gt.implementation_key AS game_type_key,
    rv.implementation_key AS ruleset_version_key,
    im.implementation_key AS input_mode_key,
    gs.implementation_key AS status_key,
    CASE WHEN ac.activity_id IS NULL THEN 'STANDALONE' ELSE 'ROUTINE' END AS context_key,
    es.routine_step_sequence_number,
    ec.configuration,
    es.started_at,
    es.completed_at,
    FLOOR(EXTRACT(EPOCH FROM (es.completed_at - es.started_at)))::integer AS duration_seconds,
    COALESCE(tf.turn_count, 0) AS turn_count,
    COALESCE(tf.counted_score, 0) AS counted_score,
    COALESCE(df.dart_count, 0) AS dart_count
FROM exercise_sessions es
    JOIN game_types gt       ON gt.id = es.game_type_id
    JOIN ruleset_versions rv ON rv.id = es.ruleset_version_id
    JOIN input_modes im      ON im.id = es.input_mode_id
    JOIN game_statuses gs    ON gs.id = es.status_id
    LEFT JOIN activity_configurations ac ON ac.activity_id = es.activity_id
    LEFT JOIN exercise_configurations ec ON ec.exercise_session_id = es.id
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS turn_count,
            SUM(t.total_score)::integer AS counted_score
        FROM turns t
            JOIN participants p     ON p.id = t.participant_id
            JOIN exercise_stages st ON st.id = t.exercise_stage_id
        WHERE st.exercise_session_id = es.id
            AND p.player_id = es.player_id
    ) tf ON TRUE
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS dart_count
        FROM darts d
            JOIN turns t            ON t.id = d.turn_id
            JOIN participants p     ON p.id = t.participant_id
            JOIN exercise_stages st ON st.id = t.exercise_stage_id
        WHERE st.exercise_session_id = es.id
            AND p.player_id = es.player_id
    ) df ON TRUE
WHERE gs.implementation_key IN ('COMPLETED', 'ABANDONED');
COMMENT ON VIEW v_stats_session_facts IS 'One row per terminal game session (owning player only) with rule-free turn/dart/score counts and derived context_key (ROUTINE when the activity has an activity_configurations snapshot). Statistics phase 1, D364.';

CREATE VIEW v_stats_dart_facts AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    rv.implementation_key AS ruleset_version_key,
    gs.implementation_key AS status_key,
    CASE WHEN ac.activity_id IS NULL THEN 'STANDALONE' ELSE 'ROUTINE' END AS context_key,
    es.completed_at,
    st.id AS stage_id,
    t.sequence_number AS turn_sequence,
    d.dart_number,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.intended_target_number,
    intended_zone.implementation_key AS intended_zone_key,
    d.score,
    d.location_x,
    d.location_y
FROM darts d
    JOIN turns t              ON t.id = d.turn_id
    JOIN participants p       ON p.id = t.participant_id
    JOIN exercise_stages st   ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt        ON gt.id = es.game_type_id
    JOIN ruleset_versions rv  ON rv.id = es.ruleset_version_id
    JOIN input_modes im       ON im.id = es.input_mode_id
    JOIN game_statuses gs     ON gs.id = es.status_id
    LEFT JOIN activity_configurations ac ON ac.activity_id = es.activity_id
    LEFT JOIN dart_zones hit_zone      ON hit_zone.id = d.hit_zone_id
    LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id
WHERE im.implementation_key = 'VISUAL_BOARD'
    AND gs.implementation_key IN ('COMPLETED', 'ABANDONED')
    AND d.location_x IS NOT NULL
    AND d.location_y IS NOT NULL
    AND p.player_id = es.player_id;
COMMENT ON VIEW v_stats_dart_facts IS 'One row per VISUAL_BOARD dart with coordinates in a terminal game session (owning player only), with the session columns statistics sections filter on. Statistics phase 1, D364.';

CREATE INDEX idx_exercise_sessions_player_game_completed
    ON exercise_sessions (player_id, game_type_id, completed_at DESC);

-- migrate:down
DROP INDEX IF EXISTS idx_exercise_sessions_player_game_completed;
DROP VIEW IF EXISTS v_stats_dart_facts;
DROP VIEW IF EXISTS v_stats_session_facts;
