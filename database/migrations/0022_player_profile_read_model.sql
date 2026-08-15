-- ============================================================
-- Migration: 0022_player_profile_read_model.sql
--
-- Purpose:
-- Let a player configure their display name and the darts
-- equipment (darts description + weight in grams) they play
-- with, and expose both as a read model.
--
-- display_name already existed (migration 0003); it had no
-- write path beyond provisioning. darts_description and
-- darts_weight_grams are new, both nullable — a player may
-- never set them.
-- ============================================================

-- migrate:up
ALTER TABLE players
ADD COLUMN darts_description TEXT,
    ADD COLUMN darts_weight_grams SMALLINT;

ALTER TABLE players
ADD CONSTRAINT chk_players_darts_description_not_empty CHECK (
        darts_description IS NULL
        OR length(TRIM(BOTH FROM darts_description)) > 0
    ),
    ADD CONSTRAINT chk_players_darts_weight_grams_range CHECK (
        darts_weight_grams IS NULL
        OR (
            darts_weight_grams > 0
            AND darts_weight_grams <= 100
        )
    );

COMMENT ON COLUMN players.darts_description IS 'Free-text darts the player uses, e.g. "Winmau Pro-Series 23g". NULL until set.';
COMMENT ON COLUMN players.darts_weight_grams IS 'Weight of the player''s darts in grams, 1-100. NULL until set.';

CREATE VIEW v_player_profile AS
SELECT id AS player_id,
    display_name,
    darts_description,
    darts_weight_grams,
    updated_at
FROM players;

COMMENT ON VIEW v_player_profile IS 'Player display name and darts equipment.';

-- migrate:down
DROP VIEW IF EXISTS v_player_profile;

ALTER TABLE players
DROP CONSTRAINT chk_players_darts_weight_grams_range,
    DROP CONSTRAINT chk_players_darts_description_not_empty;

ALTER TABLE players
DROP COLUMN darts_weight_grams,
    DROP COLUMN darts_description;
