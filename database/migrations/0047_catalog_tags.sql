-- ============================================================
-- Migration: 0047_catalog_tags.sql
--
-- Purpose:
-- Make catalog tags real data. Tags are authored in the `## Tags`
-- tables of docs/game-rules/** (vocabulary: docs/game-rules/TAGS.md)
-- and written by the generated seed 0042_catalog_tags.sql.
--
-- Contains:
-- - tag_axes, tag_contexts, tags: SMALLINT lookups, ids fixed by
--   the seed. tag_axes carries no cardinality column: "exactly
--   one" (Difficulty, Family) is enforced by the generator and its
--   drift gate, not the database.
-- - game_type_tags, exercise_type_tags: two typed link tables (no
--   EAV, no polymorphic FK). A game type is tagged per context
--   (STANDALONE, ROUTINE_STEP); an exercise type is always a
--   routine step, so it has no context column. A partial unique
--   index allows at most one primary tag per type (and context).
-- - exercise_templates.difficulty_tag_id: per-template difficulty,
--   hand-set by seed 0043 for a type whose routine-step block
--   labels several difficulties. NULL falls back to the type's.
-- - v_catalog_tags: keys and names only, never lookup ids.
-- - v_exercise_template_catalog: appends exercise_type_name,
--   game_type_name, difficulty_level, exercise_type_description
--   and game_type_description (additive, as 0040 did).
--
-- No column defaults for timestamps or ids: the generated seed writes
-- created_at/updated_at = now() and every id explicitly. tags.sort_order
-- is unique per axis (uq_tags_axis_sort_order) so the difficulty rank
-- is deterministic.
-- ============================================================

-- migrate:up
CREATE TABLE tag_axes (
    id SMALLINT PRIMARY KEY,
    implementation_key TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_tag_axes_implementation_key UNIQUE (implementation_key)
);
COMMENT ON TABLE tag_axes IS 'Tag axes from docs/game-rules/TAGS.md (Skill, Session role, Format, Difficulty, Mechanic, Pressure, Family). Seeded by 0042 (0047).';

CREATE TABLE tag_contexts (
    id SMALLINT PRIMARY KEY,
    implementation_key TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_tag_contexts_implementation_key UNIQUE (implementation_key)
);
COMMENT ON TABLE tag_contexts IS 'Where a game type''s tags apply: STANDALONE (Games screen) or ROUTINE_STEP (exercise picker). Seeded by 0042 (0047).';

CREATE TABLE tags (
    id SMALLINT PRIMARY KEY,
    tag_axis_id SMALLINT NOT NULL,
    implementation_key TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_tags_axis_implementation_key UNIQUE (tag_axis_id, implementation_key),
    CONSTRAINT uq_tags_axis_sort_order UNIQUE (tag_axis_id, sort_order),
    CONSTRAINT fk_tags_tag_axis FOREIGN KEY (tag_axis_id) REFERENCES tag_axes(id) ON DELETE RESTRICT
);
COMMENT ON TABLE tags IS 'One row per tag value in docs/game-rules/TAGS.md. sort_order follows TAGS.md row order within the axis; on the DIFFICULTY axis it drives the 1-4 meter level. Seeded by 0042 (0047).';

CREATE TABLE game_type_tags (
    game_type_id UUID NOT NULL,
    tag_context_id SMALLINT NOT NULL,
    tag_id SMALLINT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (game_type_id, tag_context_id, tag_id),
    CONSTRAINT fk_game_type_tags_game_type FOREIGN KEY (game_type_id) REFERENCES game_types(id) ON DELETE CASCADE,
    CONSTRAINT fk_game_type_tags_tag_context FOREIGN KEY (tag_context_id) REFERENCES tag_contexts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_game_type_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_game_type_tags_primary ON game_type_tags (game_type_id, tag_context_id)
    WHERE is_primary;
COMMENT ON TABLE game_type_tags IS 'Tags of a game type per context, generated from its rules file''s ## Tags table by seed 0042 (0047). At most one primary tag per game type and context.';

CREATE TABLE exercise_type_tags (
    exercise_type_id UUID NOT NULL,
    tag_id SMALLINT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (exercise_type_id, tag_id),
    CONSTRAINT fk_exercise_type_tags_exercise_type FOREIGN KEY (exercise_type_id) REFERENCES exercise_types(id) ON DELETE CASCADE,
    CONSTRAINT fk_exercise_type_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_exercise_type_tags_primary ON exercise_type_tags (exercise_type_id)
    WHERE is_primary;
COMMENT ON TABLE exercise_type_tags IS 'Tags of an exercise type (always the ROUTINE_STEP context), generated from its rules file''s ## Tags table by seed 0042 (0047). At most one primary tag per exercise type.';

ALTER TABLE exercise_templates
    ADD COLUMN difficulty_tag_id SMALLINT;

ALTER TABLE exercise_templates
    ADD CONSTRAINT fk_exercise_templates_difficulty_tag
    FOREIGN KEY (difficulty_tag_id) REFERENCES tags(id)
    ON DELETE RESTRICT;

COMMENT ON COLUMN exercise_templates.difficulty_tag_id IS 'DIFFICULTY-axis tag of this template (0047), hand-set by seed 0043 for a type whose routine-step tag block labels several difficulties. NULL falls back to the owning type''s single routine-step Difficulty in v_exercise_template_catalog.';

CREATE VIEW v_catalog_tags AS
WITH axis_ranks AS (
    SELECT t.id AS tag_id,
        row_number() OVER (PARTITION BY t.tag_axis_id ORDER BY t.sort_order, t.id)::smallint AS axis_rank
    FROM tags t
)
SELECT 'GAME'::text          AS entity_kind,
    gt.implementation_key AS type_key,
    tc.implementation_key AS context_key,
    ta.implementation_key AS axis_key,
    t.implementation_key  AS tag_key,
    t.name                AS tag_name,
    gtt.is_primary,
    t.sort_order,
    ar.axis_rank
FROM game_type_tags gtt
    JOIN game_types gt   ON gt.id = gtt.game_type_id
    JOIN tag_contexts tc ON tc.id = gtt.tag_context_id
    JOIN tags t          ON t.id = gtt.tag_id
    JOIN axis_ranks ar   ON ar.tag_id = t.id
    JOIN tag_axes ta     ON ta.id = t.tag_axis_id
UNION ALL
SELECT 'EXERCISE'::text      AS entity_kind,
    ext.implementation_key AS type_key,
    'ROUTINE_STEP'::text   AS context_key,
    ta.implementation_key  AS axis_key,
    t.implementation_key   AS tag_key,
    t.name                 AS tag_name,
    ett.is_primary,
    t.sort_order,
    ar.axis_rank
FROM exercise_type_tags ett
    JOIN exercise_types ext ON ext.id = ett.exercise_type_id
    JOIN tags t             ON t.id = ett.tag_id
    JOIN axis_ranks ar      ON ar.tag_id = t.id
    JOIN tag_axes ta        ON ta.id = t.tag_axis_id;
COMMENT ON VIEW v_catalog_tags IS 'Catalog tags per game type (per context) and exercise type (always ROUTINE_STEP), keys and names only (0047). sort_order is the tag''s order within its axis; axis_rank is its 1-based rank among ALL tags of the axis (not only linked ones), so a DIFFICULTY tag''s axis_rank is its difficulty level.';

CREATE OR REPLACE VIEW v_exercise_template_catalog AS
WITH difficulty_levels AS (
    SELECT t.id AS tag_id,
        (row_number() OVER (ORDER BY t.sort_order, t.id))::smallint AS difficulty_level
    FROM tags t
        JOIN tag_axes ta ON ta.id = t.tag_axis_id
    WHERE ta.implementation_key = 'DIFFICULTY'
)
SELECT et.id AS exercise_template_id,
    et.name,
    et.description,
    ext.implementation_key AS exercise_type_key,
    gt.implementation_key  AS game_type_key,
    grv.implementation_key AS game_ruleset_version_key,
    et.default_configuration IS NOT NULL AS has_default_configuration,
    ext.name AS exercise_type_name,
    gt.name  AS game_type_name,
    COALESCE(template_level.difficulty_level, type_level.difficulty_level) AS difficulty_level,
    ext.description AS exercise_type_description,
    gt.description  AS game_type_description
FROM exercise_templates et
    JOIN exercise_types ext ON ext.id = et.exercise_type_id
    LEFT JOIN game_types gt ON gt.id = et.game_type_id
    LEFT JOIN ruleset_versions grv ON grv.id = et.game_ruleset_version_id
    LEFT JOIN difficulty_levels template_level ON template_level.tag_id = et.difficulty_tag_id
    LEFT JOIN LATERAL (
        SELECT min(dl.difficulty_level) AS difficulty_level
        FROM (
            SELECT gtt.tag_id
            FROM game_type_tags gtt
                JOIN tag_contexts tc ON tc.id = gtt.tag_context_id
            WHERE et.game_type_id IS NOT NULL
                AND gtt.game_type_id = et.game_type_id
                AND tc.implementation_key = 'ROUTINE_STEP'
            UNION ALL
            SELECT ett.tag_id
            FROM exercise_type_tags ett
            WHERE et.game_type_id IS NULL
                AND ett.exercise_type_id = et.exercise_type_id
        ) owner_tags
            JOIN difficulty_levels dl ON dl.tag_id = owner_tags.tag_id
        HAVING count(*) = 1
    ) type_level ON TRUE
WHERE et.is_system_template
    AND ext.is_published;
COMMENT ON VIEW v_exercise_template_catalog IS 'System exercise templates a player may compose a routine from, with the game ruleset version a GAME template pins (0040), the type names and descriptions and a 1-4 difficulty_level (0047): the template''s own difficulty_tag_id, else the owning type''s single routine-step Difficulty (the game type for a GAME template, else the exercise type), else NULL.';

-- migrate:down
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

DROP VIEW IF EXISTS v_catalog_tags;

ALTER TABLE exercise_templates DROP CONSTRAINT IF EXISTS fk_exercise_templates_difficulty_tag;
ALTER TABLE exercise_templates DROP COLUMN IF EXISTS difficulty_tag_id;

DROP TABLE IF EXISTS exercise_type_tags;
DROP TABLE IF EXISTS game_type_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS tag_contexts;
DROP TABLE IF EXISTS tag_axes;
