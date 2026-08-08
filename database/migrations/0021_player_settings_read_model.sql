-- ============================================================
-- Migration: 0021_player_settings_read_model.sql
--
-- Purpose:
-- Expose player mode preferences as keys rather than ids.
--
-- A player with no settings row has no row here either; the
-- service applies the RECREATIONAL + QUICK_SCORE defaults and
-- creates the row lazily on first write. No backfill.
-- ============================================================

-- migrate:up
CREATE VIEW v_player_settings AS
SELECT ps.player_id,
    cm.implementation_key AS default_capture_mode_key,
    im.implementation_key AS default_input_mode_key,
    ps.updated_at
FROM player_settings ps
    LEFT JOIN capture_modes cm ON cm.id = ps.default_capture_mode_id
    LEFT JOIN input_modes im ON im.id = ps.default_input_mode_id;

COMMENT ON VIEW v_player_settings IS 'Player mode preferences as implementation keys; absent row means defaults apply.';

-- migrate:down
DROP VIEW IF EXISTS v_player_settings;
