-- ============================================================
-- Migration: 0040_exercise_template_game_ruleset.sql
--
-- Purpose:
-- Let a GAME exercise template pin the game ruleset version its
-- default_configuration was written against — the game-side
-- mirror of 0035. Until now startGameStep hardcoded TUOD/TUOD_V1,
-- so a second game template could not be seeded at all.
--
-- The foreign key is composite over (game_type_id,
-- game_ruleset_version_id) so a template cannot pin another
-- game's ruleset; ruleset_versions gets the referenceable pair
-- (game_type_id, id), already unique by way of the primary key.
--
-- The CHECK runs one way only: a pinned version requires a game
-- type, never the reverse. A GAME template with no pin is ordinary
-- and permanent — seed 0002's 501 Match, Singles Accuracy and the
-- rest carry a game_type_id and pin nothing, because only a game
-- with a native timed mode is routine-eligible at all. The reverse
-- direction would reject them on every fresh database, and no
-- amount of NOT VALID helps: seeds INSERT those rows rather than
-- inherit them. What refuses an unpinned game at routine time is
-- routineGameStepHook, not this constraint.
--
-- Both routine views are recreated to expose
-- game_ruleset_version_key (LEFT JOIN, additive).
-- ============================================================

-- migrate:up
ALTER TABLE ruleset_versions
    ADD CONSTRAINT uq_ruleset_versions_game_type_id UNIQUE (game_type_id, id);

ALTER TABLE exercise_templates
    ADD COLUMN game_ruleset_version_id UUID;

ALTER TABLE exercise_templates
    ADD CONSTRAINT fk_exercise_templates_game_ruleset_version
    FOREIGN KEY (game_type_id, game_ruleset_version_id)
    REFERENCES ruleset_versions (game_type_id, id)
    ON DELETE RESTRICT;

ALTER TABLE exercise_templates
    ADD CONSTRAINT chk_exercise_templates_game_ruleset_pair
    CHECK (game_ruleset_version_id IS NULL OR game_type_id IS NOT NULL);

COMMENT ON COLUMN exercise_templates.game_ruleset_version_id IS 'Game ruleset version a GAME template''s default_configuration was written against (0040). NULL for a non-game template, and NULL for a GAME template whose game has no native timed mode and so cannot be a routine step; chk_exercise_templates_game_ruleset_pair only requires game_type_id alongside a non-NULL version.';

DROP VIEW IF EXISTS v_routine_execution;
CREATE VIEW v_routine_execution AS
SELECT rt.id AS routine_id,
    rt.name AS routine_name,
    rt.is_system_template,
    rt.player_id,
    rt.description AS routine_description,
    rs.sequence_number,
    et.id   AS exercise_template_id,
    et.name AS exercise_name,
    et.description AS exercise_description,
    ext.implementation_key AS exercise_type_key,
    erv.implementation_key AS exercise_ruleset_version_key,
    gt.implementation_key AS game_type_key,
    grv.implementation_key AS game_ruleset_version_key,
    rs.duration_value,
    dt.implementation_key AS duration_type_key,
    et.default_configuration,
    rs.configuration AS step_configuration
FROM routine_templates rt
    JOIN routine_steps rs      ON rs.routine_template_id = rt.id
    JOIN exercise_templates et ON et.id = rs.exercise_template_id
    JOIN exercise_types ext    ON ext.id = et.exercise_type_id
    JOIN duration_types dt     ON dt.id = rs.duration_type_id
    LEFT JOIN game_types gt    ON gt.id = et.game_type_id
    LEFT JOIN ruleset_versions grv ON grv.id = et.game_ruleset_version_id
    LEFT JOIN exercise_ruleset_versions erv ON erv.id = et.exercise_ruleset_version_id;
COMMENT ON VIEW v_routine_execution IS 'Ordered routine execution definition with owner, descriptions (0038) and the game ruleset version a GAME step pins (0040). game_type_key/game_ruleset_version_key and exercise_ruleset_version_key are NULL for a non-game and a game step respectively.';

DROP VIEW IF EXISTS v_exercise_template_catalog;
CREATE VIEW v_exercise_template_catalog AS
SELECT et.id AS exercise_template_id,
    et.name,
    et.description,
    ext.implementation_key AS exercise_type_key,
    gt.implementation_key  AS game_type_key,
    grv.implementation_key AS game_ruleset_version_key,
    et.default_configuration IS NOT NULL AS has_default_configuration
FROM exercise_templates et
    JOIN exercise_types ext ON ext.id = et.exercise_type_id
    LEFT JOIN game_types gt ON gt.id = et.game_type_id
    LEFT JOIN ruleset_versions grv ON grv.id = et.game_ruleset_version_id
WHERE et.is_system_template
    AND ext.is_published;
COMMENT ON VIEW v_exercise_template_catalog IS 'System exercise templates a player may compose a routine from, with the game ruleset version a GAME template pins (0040).';

-- migrate:down
DROP VIEW IF EXISTS v_exercise_template_catalog;
CREATE VIEW v_exercise_template_catalog AS
SELECT et.id AS exercise_template_id,
    et.name,
    et.description,
    ext.implementation_key AS exercise_type_key,
    gt.implementation_key  AS game_type_key,
    et.default_configuration IS NOT NULL AS has_default_configuration
FROM exercise_templates et
    JOIN exercise_types ext ON ext.id = et.exercise_type_id
    LEFT JOIN game_types gt ON gt.id = et.game_type_id
WHERE et.is_system_template
    AND ext.is_published;
COMMENT ON VIEW v_exercise_template_catalog IS 'System exercise templates a player may compose a routine from. has_default_configuration = FALSE marks a template the service must not offer: its step would resolve to an empty configuration.';

DROP VIEW IF EXISTS v_routine_execution;
CREATE VIEW v_routine_execution AS
SELECT rt.id AS routine_id,
    rt.name AS routine_name,
    rt.is_system_template,
    rt.player_id,
    rt.description AS routine_description,
    rs.sequence_number,
    et.id   AS exercise_template_id,
    et.name AS exercise_name,
    et.description AS exercise_description,
    ext.implementation_key AS exercise_type_key,
    erv.implementation_key AS exercise_ruleset_version_key,
    gt.implementation_key AS game_type_key,
    rs.duration_value,
    dt.implementation_key AS duration_type_key,
    et.default_configuration,
    rs.configuration AS step_configuration
FROM routine_templates rt
    JOIN routine_steps rs      ON rs.routine_template_id = rt.id
    JOIN exercise_templates et ON et.id = rs.exercise_template_id
    JOIN exercise_types ext    ON ext.id = et.exercise_type_id
    JOIN duration_types dt     ON dt.id = rs.duration_type_id
    LEFT JOIN game_types gt    ON gt.id = et.game_type_id
    LEFT JOIN exercise_ruleset_versions erv ON erv.id = et.exercise_ruleset_version_id;
COMMENT ON VIEW v_routine_execution IS 'Ordered routine execution definition, carrying everything a step resolves from plus the routine''s owner (player_id, NULL for a system routine) and both descriptions (0038). game_type_key and exercise_ruleset_version_key are NULL for a non-game and a game step respectively.';

ALTER TABLE exercise_templates DROP CONSTRAINT IF EXISTS chk_exercise_templates_game_ruleset_pair;
ALTER TABLE exercise_templates DROP CONSTRAINT IF EXISTS fk_exercise_templates_game_ruleset_version;
ALTER TABLE exercise_templates DROP COLUMN IF EXISTS game_ruleset_version_id;
ALTER TABLE ruleset_versions DROP CONSTRAINT IF EXISTS uq_ruleset_versions_game_type_id;
