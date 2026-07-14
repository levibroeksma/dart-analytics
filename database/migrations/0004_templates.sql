-- ============================================================
-- Migration: 0004_templates.sql
--
-- Purpose:
-- Create reusable training template structures.
--
-- Templates describe possible exercises.
-- They are not executed gameplay.
--
-- ============================================================

-- migrate:up
-- ============================================================
-- exercise_templates
--
-- Defines reusable exercises.
--
-- Examples:
-- - Singles accuracy
-- - Score training
-- - TUOD
--
-- ============================================================
CREATE TABLE exercise_templates (
    id UUID PRIMARY KEY,
    game_type_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_system_template BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_exercise_templates_game_type FOREIGN KEY (game_type_id) REFERENCES game_types(id) ON DELETE RESTRICT
);
COMMENT ON TABLE exercise_templates IS 'Reusable exercise definitions.';
-- ============================================================
-- routine_templates
--
-- Defines composed training routines.
--
-- ============================================================
CREATE TABLE routine_templates (
    id UUID PRIMARY KEY,
    player_id UUID,
    name TEXT NOT NULL,
    description TEXT,
    is_system_template BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_routine_templates_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);
COMMENT ON TABLE routine_templates IS 'Composable training routines.';
-- ============================================================
-- routine_steps
--
-- Ordered exercises inside routines.
--
-- ============================================================
CREATE TABLE routine_steps (
    id UUID PRIMARY KEY,
    routine_template_id UUID NOT NULL,
    exercise_template_id UUID NOT NULL,
    sequence_number INTEGER NOT NULL,
    -- Controlled duration measurement (ROUNDS, MINUTES).
    --
    -- References the duration_types lookup table.
    -- Free-text duration values are not allowed.
    --
    duration_type_id SMALLINT NOT NULL,
    duration_value INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_routine_steps_routine FOREIGN KEY (routine_template_id) REFERENCES routine_templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_routine_steps_exercise FOREIGN KEY (exercise_template_id) REFERENCES exercise_templates(id) ON DELETE RESTRICT,
    CONSTRAINT fk_routine_steps_duration_type FOREIGN KEY (duration_type_id) REFERENCES duration_types(id) ON DELETE RESTRICT
);
COMMENT ON TABLE routine_steps IS 'Ordered composition of exercises inside a routine.';

-- migrate:down
DROP TABLE IF EXISTS routine_steps;
DROP TABLE IF EXISTS routine_templates;
DROP TABLE IF EXISTS exercise_templates;
