-- ============================================================
-- Migration: 0003_players.sql
--
-- Purpose:
-- Create application-owned player entities.
--
-- Authentication is handled externally by Neon Auth.
-- This table only stores application profile data.
--
-- ============================================================

-- migrate:up
-- ============================================================
-- players
--
-- Represents a player inside the application.
--
-- Authentication identity is intentionally separated.
--
-- ============================================================
CREATE TABLE players (
    id UUID PRIMARY KEY,
    -- External authentication identifier.
    --
    -- This references the identity managed by Neon Auth.
    -- The database does not manage authentication.
    --
    auth_user_id TEXT NOT NULL,
    -- User-configurable nickname.
    --
    -- Examples:
    -- The Power
    -- Mighty
    --
    -- Not unique.
    --
    display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_players_auth_user_id UNIQUE (auth_user_id)
);
COMMENT ON TABLE players IS 'Application profile linked to external authentication.';
COMMENT ON COLUMN players.display_name IS 'Configurable nickname. Not required to be unique.';
-- ============================================================
-- player_settings
--
-- Stores user preferences.
--
-- Uses shared primary key pattern.
--
-- ============================================================
CREATE TABLE player_settings (
    player_id UUID PRIMARY KEY,
    default_capture_mode_id SMALLINT,
    default_input_mode_id SMALLINT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_player_settings_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);
COMMENT ON TABLE player_settings IS 'Stores player-specific application preferences.';

-- migrate:down
DROP TABLE IF EXISTS player_settings;
DROP TABLE IF EXISTS players;
