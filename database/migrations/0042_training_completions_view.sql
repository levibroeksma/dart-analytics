-- ============================================================
-- Migration: 0042_training_completions_view.sql
--
-- Purpose:
-- Read model for "has this routine been trained today": one row
-- per COMPLETED training activity with the routine it ran.
--
-- A training activity is one carrying an activity_configurations
-- snapshot (0030). The routine id and name come from that
-- snapshot, never a template FK, so editing or deleting a
-- routine never rewrites history. Abandoned trainings are not
-- completions and are filtered out. "Today" is the player's
-- local day, which only the client knows — callers filter
-- completed_at by an instant, the view stays day-agnostic.
-- ============================================================

-- migrate:up
CREATE VIEW v_training_completions AS
SELECT a.id AS activity_id,
    a.player_id,
    ac.configuration ->> 'routineTemplateId' AS routine_template_id,
    ac.configuration ->> 'routineName' AS routine_name,
    a.completed_at
FROM activities a
    JOIN activity_configurations ac ON ac.activity_id = a.id
    JOIN game_statuses gs ON gs.id = a.status_id
WHERE gs.implementation_key = 'COMPLETED';
COMMENT ON VIEW v_training_completions IS 'One row per completed training activity with the routine snapshot it ran; filter by player_id and completed_at.';

-- migrate:down
DROP VIEW IF EXISTS v_training_completions;
