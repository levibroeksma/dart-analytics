-- ============================================================
-- v_player_leg_facts: one row per LEG-type stage, owning
-- participant only (X01 games -- 501/121/TUOD -- are the only
-- game types that ever create a LEG stage).
--
-- A leg is included only when EVERY one of the owning
-- participant's turns in it has at least one real dart row. A
-- QUICK_SCORE leg's real per-turn dart count is unknown (a
-- checkout or bust can resolve on any dart), so this view
-- narrows the population rather than approximating a count that
-- would look exact but isn't -- same precedent as
-- v_dart_analytics's "both intended target and zone present"
-- filter (05-Views.md).
-- ============================================================

-- migrate:up
CREATE VIEW v_player_leg_facts AS
WITH leg_turns AS (
    SELECT t.id AS turn_id,
        t.exercise_stage_id,
        COUNT(d.id) AS dart_count
    FROM turns t
        JOIN participants p ON p.id = t.participant_id
        JOIN exercise_stages st ON st.id = t.exercise_stage_id
        JOIN exercise_sessions es ON es.id = st.exercise_session_id
        LEFT JOIN darts d ON d.turn_id = t.id
    WHERE p.player_id = es.player_id
        AND t.completed_at IS NOT NULL
    GROUP BY t.id, t.exercise_stage_id
)
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    st.id AS stage_id,
    SUM(lt.dart_count) AS total_darts_in_leg
FROM leg_turns lt
    JOIN exercise_stages st ON st.id = lt.exercise_stage_id
    JOIN stage_types stype ON stype.id = st.stage_type_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
WHERE stype.implementation_key = 'LEG'
GROUP BY es.id, es.player_id, gt.implementation_key, st.id
HAVING bool_and(lt.dart_count > 0);
COMMENT ON VIEW v_player_leg_facts IS 'One row per LEG stage (owning player only), total real darts thrown in that leg -- only legs where every turn has real dart rows; incomplete-capture legs are excluded, never approximated.';

-- migrate:down
DROP VIEW IF EXISTS v_player_leg_facts;
