-- ============================================================
-- v_double_out_checkout_darts: raw per-dart facts for 501
-- VISUAL_BOARD sessions, plus the remaining score each dart
-- opened against, for reproducing dart-level double-attempt
-- accuracy outside the live in-session read.
--
-- Scoped to 501 only. TUOD/121's "remaining before a dart"
-- depends on a ladder fold (finishBonus/missPenalty escalation)
-- that is game-engine logic, not SQL arithmetic -- 05-Views.md
-- forbids that in a view. Their persisted double-accuracy reads
-- are a follow-up needing an application-layer replay instead.
--
-- remaining_before_dart resets at each LEG (exercise_stage_id)
-- boundary to the session's own starting_score, which 501 does
-- not store per-session (it lives in exercise_configurations'
-- JSONB snapshot) -- so this view exposes the running SUM of
-- prior dart scores within (stage, participant) instead, and the
-- application read layer (which already has the session's
-- configuration snapshot) adds its own starting_score to get the
-- true remaining. This keeps the view a plain arithmetic
-- projection, never a JSONB-parsing one.
--
-- Scoped to the session's owning participant, mirroring
-- v_dart_analytics/v_dart_locations (migration 0023).
-- ============================================================

-- migrate:up
CREATE VIEW v_double_out_checkout_darts AS
SELECT es.id AS session_id,
    es.player_id,
    st.id AS stage_id,
    t.sequence_number AS turn_sequence,
    d.dart_number,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.score,
    SUM(d.score) OVER (
        PARTITION BY st.id, t.participant_id
        ORDER BY t.sequence_number, d.dart_number
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS prior_scored_in_stage
FROM darts d
    JOIN turns t ON t.id = d.turn_id
    JOIN participants p ON p.id = t.participant_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN input_modes im ON im.id = es.input_mode_id
    LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id
WHERE gt.implementation_key = '501'
    AND im.implementation_key = 'VISUAL_BOARD'
    AND p.player_id = es.player_id;
COMMENT ON VIEW v_double_out_checkout_darts IS 'Raw per-dart facts for 501 VISUAL_BOARD sessions, plus prior score within the leg, for dart-level double-attempt accuracy (owning player only). prior_scored_in_stage + the session''s own starting_score gives remaining-before-dart in the application read layer.';

-- migrate:down
DROP VIEW IF EXISTS v_double_out_checkout_darts;
