-- ============================================================
-- Migration: 0049_ruleset_version_tags.sql
--
-- Purpose:
-- Let a preset card carry its own catalog tags. Nine Lives is a
-- card on the Around the Clock game type (ruleset AROUND_THE_CLOCK_V3)
-- and must read as a different difficulty and format than the
-- Around the Clock card, which game_type_tags cannot express.
--
-- Contains:
-- - ruleset_version_tags: a third typed link table beside
--   game_type_tags and exercise_type_tags (no EAV, no polymorphic
--   FK). A card is always a STANDALONE entry, so it has no context
--   column. A partial unique index allows at most one primary tag
--   per ruleset version.
-- - v_catalog_tags: recreated with a third UNION ALL branch,
--   entity_kind CARD, type_key the ruleset implementation key,
--   context_key STANDALONE. The GAME and EXERCISE branches are
--   unchanged.
--
-- No column defaults for timestamps: the generated seed
-- 0042_catalog_tags.sql writes created_at = now() explicitly.
-- ============================================================

-- migrate:up
CREATE TABLE ruleset_version_tags (
    ruleset_version_id UUID NOT NULL,
    tag_id SMALLINT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (ruleset_version_id, tag_id),
    CONSTRAINT fk_ruleset_version_tags_ruleset_version FOREIGN KEY (ruleset_version_id) REFERENCES ruleset_versions(id) ON DELETE CASCADE,
    CONSTRAINT fk_ruleset_version_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_ruleset_version_tags_primary ON ruleset_version_tags (ruleset_version_id)
    WHERE is_primary;
COMMENT ON TABLE ruleset_version_tags IS 'Tags of a preset card (a ruleset version shown as its own Games-screen card), generated from its rules file''s Card ruleset ## Tags table by seed 0042 (0049). At most one primary tag per ruleset version.';

DROP VIEW IF EXISTS v_catalog_tags;
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
    JOIN tag_axes ta        ON ta.id = t.tag_axis_id
UNION ALL
SELECT 'CARD'::text          AS entity_kind,
    rv.implementation_key  AS type_key,
    'STANDALONE'::text     AS context_key,
    ta.implementation_key  AS axis_key,
    t.implementation_key   AS tag_key,
    t.name                 AS tag_name,
    rvt.is_primary,
    t.sort_order,
    ar.axis_rank
FROM ruleset_version_tags rvt
    JOIN ruleset_versions rv ON rv.id = rvt.ruleset_version_id
    JOIN tags t              ON t.id = rvt.tag_id
    JOIN axis_ranks ar       ON ar.tag_id = t.id
    JOIN tag_axes ta         ON ta.id = t.tag_axis_id;
COMMENT ON VIEW v_catalog_tags IS 'Catalog tags per game type (per context), exercise type (always ROUTINE_STEP) and preset card (always STANDALONE, keyed by ruleset version key), keys and names only (0049). sort_order is the tag''s order within its axis; axis_rank is its 1-based rank among ALL tags of the axis (not only linked ones), so a DIFFICULTY tag''s axis_rank is its difficulty level.';

-- migrate:down
DROP VIEW IF EXISTS v_catalog_tags;
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

DROP TABLE IF EXISTS ruleset_version_tags;
