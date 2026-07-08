-- ============================================================
-- Migration: 0010_configuration_templates.sql
--
-- Purpose:
-- Create reusable configuration presets.
--
-- Completes the configuration chain:
--
-- Template (this table)
--   -> Snapshot (exercise_configurations)
--     -> Runtime Session
--
-- Runtime never references this table.
-- Values are copied into the snapshot at session start.
--
-- ============================================================
BEGIN;
-- ============================================================
-- configuration_templates
--
-- Named configuration presets per game type.
--
-- Examples:
-- - "501 - Best of 5, Double Out"
-- - "TUOD - 10 minutes, standard difficulty"
--
-- System presets: player_id IS NULL, is_system_template TRUE.
-- User presets:   player_id references the owning player.
--
-- The JSONB structure per game type is defined by the
-- ruleset version's configuration schema.
-- Validation is an application responsibility.
--
-- ============================================================
CREATE TABLE configuration_templates (
    id UUID PRIMARY KEY,
    game_type_id UUID NOT NULL,
    player_id UUID,
    name TEXT NOT NULL,
    description TEXT,
    configuration JSONB NOT NULL,
    is_system_template BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_configuration_templates_game_type FOREIGN KEY (game_type_id) REFERENCES game_types(id) ON DELETE RESTRICT,
    CONSTRAINT fk_configuration_templates_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    CONSTRAINT chk_configuration_templates_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_configuration_templates_object CHECK (jsonb_typeof(configuration) = 'object'),
    -- System presets must not belong to a player.
    CONSTRAINT chk_configuration_templates_system_ownership CHECK (
        NOT is_system_template
        OR player_id IS NULL
    )
);
COMMENT ON TABLE configuration_templates IS 'Reusable named configuration presets copied into session snapshots.';
COMMENT ON COLUMN configuration_templates.configuration IS 'Preset values. Structure defined by the game type ruleset schema.';
-- ============================================================
-- Query paths
--
-- - list presets for a game type (system + own)
-- ============================================================
CREATE INDEX idx_configuration_templates_game_type ON configuration_templates (game_type_id);
CREATE INDEX idx_configuration_templates_player ON configuration_templates (player_id)
WHERE player_id IS NOT NULL;
COMMIT;
