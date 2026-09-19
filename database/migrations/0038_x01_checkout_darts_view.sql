-- ============================================================
-- v_x01_checkout_darts: per-dart facts for the three X01
-- ladders (501, TUOD, 121) under VISUAL_BOARD capture, for
-- dart-level checkout accuracy outside the live in-session
-- read.
--
-- Replaces v_double_out_checkout_darts (0024, widened in
-- 0036), which projected a running SUM(d.score) as the leg's
-- prior score. A busted visit stores turns.total_score = 0
-- while keeping its darts' real board scores -- that
-- divergence is deliberate (it is what makes bust rate
-- computable) -- so the SUM over darts overstated the leg's
-- counted score and moved every later dart in that leg onto a
-- remaining the player was never on.
--
-- This view therefore projects no running totals at all. It
-- exposes facts only: the counted turn total, the dart, the
-- stage tree, the session's configuration snapshot and its
-- ruleset version. The application read layer folds them
-- through the same checkout-visits builder the live result
-- modals use, so remaining-before-dart has exactly one
-- definition. TUOD's and 121's ladders (finishBonus /
-- missPenalty escalation) are game-engine logic that
-- 05-Views.md forbids in a view, which is why they could not
-- join 501 here until the fold moved into the app.
--
-- Scoped to the session's owning participant, mirroring
-- v_dart_analytics / v_dart_locations (migration 0023). The
-- configuration join is LEFT and cannot fan out:
-- uq_exercise_configurations_exercise_session (renamed by 0037
-- from uq_exercise_configuration_session) makes
-- exercise_configurations at most one row per session.
-- ============================================================

-- migrate:up
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

DROP VIEW IF EXISTS v_double_out_checkout_darts;

-- migrate:down
DROP VIEW IF EXISTS v_x01_checkout_darts;
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
    ) AS prior_scored_in_stage,
    (ec.configuration ->> 'starting_score')::int AS starting_score
FROM darts d
    JOIN turns t ON t.id = d.turn_id
    JOIN participants p ON p.id = t.participant_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN input_modes im ON im.id = es.input_mode_id
    LEFT JOIN exercise_configurations ec ON ec.exercise_session_id = es.id
    LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id
WHERE gt.implementation_key = '501'
    AND im.implementation_key = 'VISUAL_BOARD'
    AND p.player_id = es.player_id;
COMMENT ON VIEW v_double_out_checkout_darts IS 'Raw per-dart facts for 501 VISUAL_BOARD sessions, plus prior score within the leg and the session''s configured starting_score, for dart-level double-attempt accuracy (owning player only). starting_score - prior_scored_in_stage gives remaining-before-dart; starting_score is NULL when the session stored no configuration snapshot.';
