-- ============================================================
-- Migration: 0002_reference_tables.sql
--
-- Purpose:
-- Create stable reference layer tables.
--
-- Contains:
-- - game definitions
-- - feature definitions
-- - status definitions
-- - capture modes
-- - input modes
-- - ruleset versions
--
-- Reference tables use SMALLINT identifiers.
--
-- Domain entities use UUIDv7.
--
-- ============================================================

-- migrate:up
-- ============================================================
-- game_types
--
-- Defines available dart games.
--
-- This is NOT a lookup table.
-- Games are domain entities.
--
-- ============================================================
CREATE TABLE game_types (
    id UUID PRIMARY KEY,
    implementation_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_game_types_implementation_key UNIQUE (implementation_key)
);
COMMENT ON TABLE game_types IS 'Defines available dart game implementations.';
-- ============================================================
-- game_features
--
-- Controlled list of supported game capabilities.
--
-- Examples:
-- - timed_mode
-- - rounds_mode
-- - opponent_support
--
-- ============================================================
CREATE TABLE game_features (
    id SMALLINT PRIMARY KEY,
    implementation_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_game_features_implementation_key UNIQUE (implementation_key)
);
COMMENT ON TABLE game_features IS 'Defines reusable capabilities supported by game types.';
-- ============================================================
-- game_type_features
--
-- Many-to-many relationship between games and features.
--
-- ============================================================
CREATE TABLE game_type_features (
    game_type_id UUID NOT NULL,
    game_feature_id SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (
        game_type_id,
        game_feature_id
    ),
    CONSTRAINT fk_game_type_features_game_type FOREIGN KEY (game_type_id) REFERENCES game_types(id) ON DELETE CASCADE,
    CONSTRAINT fk_game_type_features_feature FOREIGN KEY (game_feature_id) REFERENCES game_features(id) ON DELETE CASCADE
);
COMMENT ON TABLE game_type_features IS 'Defines features available for each game type.';
-- ============================================================
-- game_statuses
--
-- Lifecycle states.
--
-- Examples:
-- ACTIVE
-- COMPLETED
-- ABANDONED
--
-- ============================================================
CREATE TABLE game_statuses (
    id SMALLINT PRIMARY KEY,
    implementation_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_game_statuses_implementation_key UNIQUE (implementation_key)
);
COMMENT ON TABLE game_statuses IS 'Defines lifecycle states for runtime entities.';
-- ============================================================
-- capture_modes
--
-- Defines data collection depth.
--
-- Examples:
-- recreational
-- analytics
--
-- ============================================================
CREATE TABLE capture_modes (
    id SMALLINT PRIMARY KEY,
    implementation_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_capture_modes_implementation_key UNIQUE (implementation_key)
);
COMMENT ON TABLE capture_modes IS 'Defines how much gameplay detail is captured.';
-- ============================================================
-- input_modes
--
-- Defines user interaction style.
--
-- Examples:
-- quick_score
-- detailed_darts
--
-- ============================================================
CREATE TABLE input_modes (
    id SMALLINT PRIMARY KEY,
    implementation_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_input_modes_implementation_key UNIQUE (implementation_key)
);
COMMENT ON TABLE input_modes IS 'Defines available dart input methods.';
-- ============================================================
-- duration_types
--
-- Defines how an exercise duration is measured.
--
-- Examples:
-- - ROUNDS
-- - MINUTES
--
-- Used by:
-- - routine_steps
-- - exercise configurations
--
-- ============================================================
CREATE TABLE duration_types (
    id SMALLINT PRIMARY KEY,
    implementation_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_duration_types_implementation_key UNIQUE (implementation_key)
);
COMMENT ON TABLE duration_types IS 'Defines supported duration measurement units.';
-- ============================================================
-- participant_types
--
-- Defines entities that can participate in gameplay.
--
-- Examples:
-- PLAYER
-- GUEST
-- DARTBOT
--
-- ============================================================
CREATE TABLE participant_types (
    id SMALLINT PRIMARY KEY,
    implementation_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_participant_types_implementation_key UNIQUE (implementation_key)
);
COMMENT ON TABLE participant_types IS 'Defines supported participant categories.';
-- ============================================================
-- ruleset_versions
--
-- Immutable rule versions.
--
-- Historical sessions reference the exact ruleset used.
--
-- ============================================================
CREATE TABLE ruleset_versions (
    id UUID PRIMARY KEY,
    game_type_id UUID NOT NULL,
    implementation_key TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_ruleset_versions_game_type FOREIGN KEY (game_type_id) REFERENCES game_types(id) ON DELETE RESTRICT,
    CONSTRAINT uq_ruleset_versions_key UNIQUE (
        game_type_id,
        implementation_key
    ),
    CONSTRAINT uq_ruleset_versions_number UNIQUE (
        game_type_id,
        version_number
    )
);
COMMENT ON TABLE ruleset_versions IS 'Immutable game rule versions used for historical replay.';
-- ============================================================
-- dart_zones
--
-- Defines dart board scoring regions.
--
-- Examples:
-- SINGLE
-- DOUBLE
-- TREBLE
-- OUTER_BULL
-- INNER_BULL
-- MISS
--
-- ============================================================
CREATE TABLE dart_zones (
    id SMALLINT PRIMARY KEY,
    implementation_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_dart_zones_implementation_key UNIQUE (implementation_key)
);
COMMENT ON TABLE dart_zones IS 'Defines dart board scoring zones.';

-- migrate:down
DROP TABLE IF EXISTS game_type_features;
DROP TABLE IF EXISTS ruleset_versions;
DROP TABLE IF EXISTS game_types;
DROP TABLE IF EXISTS game_features;
DROP TABLE IF EXISTS game_statuses;
DROP TABLE IF EXISTS capture_modes;
DROP TABLE IF EXISTS input_modes;
DROP TABLE IF EXISTS duration_types;
DROP TABLE IF EXISTS participant_types;
DROP TABLE IF EXISTS dart_zones;
