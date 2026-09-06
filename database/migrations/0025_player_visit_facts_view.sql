-- ============================================================
-- v_player_visit_facts: one row per completed turn, every game
-- type and capture mode, for career-wide turn-level statistics.
--
-- dart_count is the REAL count of dart rows for the turn -- 0 for
-- QUICK_SCORE turns, where no dart rows are ever written.
-- configured_max_darts_per_turn is the ruleset's configured value
-- for the session (from exercise_configurations' JSONB snapshot),
-- exposed as a raw fact so the application read layer can decide
-- its own approximation strategy rather than the view guessing.
--
-- Scoped to the session's owning participant, mirroring
-- v_dart_analytics/v_dart_locations/v_double_out_checkout_darts.
-- Only completed turns are included -- an open visit carries a
-- running total, not a result (05-Views.md forbids exposing
-- workflow state as though it were a finished fact).
-- ============================================================

-- migrate:up
CREATE VIEW v_player_visit_facts AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    st.id AS stage_id,
    stype.implementation_key AS stage_type_key,
    t.sequence_number AS turn_sequence,
    t.total_score,
    t.completed_at,
    COUNT(d.id) AS dart_count,
    (ec.configuration ->> 'max_darts_per_turn')::int AS configured_max_darts_per_turn
FROM turns t
    JOIN participants p ON p.id = t.participant_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN stage_types stype ON stype.id = st.stage_type_id
    LEFT JOIN exercise_configurations ec ON ec.exercise_session_id = es.id
    LEFT JOIN darts d ON d.turn_id = t.id
WHERE p.player_id = es.player_id
    AND t.completed_at IS NOT NULL
GROUP BY es.id,
    es.player_id,
    gt.implementation_key,
    st.id,
    stype.implementation_key,
    t.sequence_number,
    t.total_score,
    t.completed_at,
    ec.configuration;
COMMENT ON VIEW v_player_visit_facts IS 'One row per completed turn, every game type and capture mode (owning player only): real dart count plus the configured max-darts-per-turn, for career-wide turn-level statistics.';

-- migrate:down
DROP VIEW IF EXISTS v_player_visit_facts;
