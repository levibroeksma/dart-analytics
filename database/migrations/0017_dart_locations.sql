-- ============================================================
-- Migration: 0017_dart_locations.sql
--
-- Purpose:
-- Capture where a dart landed.
--
-- darts.location_x / location_y store the landing point in
-- regulation millimetres, origin at the bull centre, y
-- increasing downward to match dartboard.svg. They are
-- nullable: quick-score sessions write no dart rows at all,
-- and a visual session records NULL for a dart whose landing
-- point was never seen (bounce-out).
--
-- Also adds the two player_settings foreign keys that
-- 06-Spec/03-Player-Layer.md specifies but migration 0003
-- never created.
-- ============================================================

-- migrate:up
ALTER TABLE darts
ADD COLUMN location_x NUMERIC(6, 2),
    ADD COLUMN location_y NUMERIC(6, 2);

ALTER TABLE darts
ADD CONSTRAINT chk_dart_location_pair CHECK (
        (
            location_x IS NULL
            AND location_y IS NULL
        )
        OR (
            location_x IS NOT NULL
            AND location_y IS NOT NULL
        )
    );

COMMENT ON COLUMN darts.location_x IS 'Landing point, millimetres right of the bull centre.';
COMMENT ON COLUMN darts.location_y IS 'Landing point, millimetres below the bull centre.';

ALTER TABLE player_settings
ADD CONSTRAINT fk_player_settings_capture_mode FOREIGN KEY (default_capture_mode_id) REFERENCES capture_modes(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_player_settings_input_mode FOREIGN KEY (default_input_mode_id) REFERENCES input_modes(id) ON DELETE RESTRICT;

-- migrate:down
ALTER TABLE player_settings
DROP CONSTRAINT fk_player_settings_input_mode,
    DROP CONSTRAINT fk_player_settings_capture_mode;

ALTER TABLE darts
DROP CONSTRAINT chk_dart_location_pair;

ALTER TABLE darts
DROP COLUMN location_y,
    DROP COLUMN location_x;
