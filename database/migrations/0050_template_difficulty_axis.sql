-- ============================================================
-- Migration: 0050_template_difficulty_axis.sql
--
-- Purpose:
-- exercise_templates.difficulty_tag_id must hold a DIFFICULTY-axis
-- tag, but fk_exercise_templates_difficulty_tag (0047) referenced
-- tags(id) with no axis restriction: a tag of any other axis was
-- accepted and v_exercise_template_catalog silently fell back to
-- the type's difficulty. Only seeded system templates were guarded
-- (by an integration test); a user template was not.
--
-- Contains:
-- - uq_tags_id_axis: UNIQUE (id, tag_axis_id) on tags, the target a
--   composite foreign key needs. id alone is already unique, so the
--   constraint admits no new row.
-- - exercise_templates.difficulty_tag_axis_id: a STORED generated
--   column, 4 (the seeded DIFFICULTY axis id, tag_axes 0042) while
--   difficulty_tag_id is set, NULL otherwise.
-- - fk_exercise_templates_difficulty_tag replaced by a composite FK
--   (difficulty_tag_id, difficulty_tag_axis_id) -> tags(id,
--   tag_axis_id). MATCH SIMPLE skips the check when the tag is NULL,
--   so a template without its own difficulty is unaffected.
--
-- No data change: seed 0043 sets only DIFFICULTY tags, so every
-- existing row satisfies the new FK.
-- ============================================================

-- migrate:up
ALTER TABLE tags
    ADD CONSTRAINT uq_tags_id_axis UNIQUE (id, tag_axis_id);

ALTER TABLE exercise_templates
    ADD COLUMN difficulty_tag_axis_id SMALLINT
    GENERATED ALWAYS AS (CASE WHEN difficulty_tag_id IS NULL THEN NULL ELSE 4::smallint END) STORED;

ALTER TABLE exercise_templates
    DROP CONSTRAINT fk_exercise_templates_difficulty_tag;

ALTER TABLE exercise_templates
    ADD CONSTRAINT fk_exercise_templates_difficulty_tag
    FOREIGN KEY (difficulty_tag_id, difficulty_tag_axis_id) REFERENCES tags(id, tag_axis_id)
    ON DELETE RESTRICT;

COMMENT ON COLUMN exercise_templates.difficulty_tag_axis_id IS 'Always the DIFFICULTY axis id (4) while difficulty_tag_id is set; only there so fk_exercise_templates_difficulty_tag can pin the axis (0050). Never written.';

-- migrate:down
ALTER TABLE exercise_templates DROP CONSTRAINT IF EXISTS fk_exercise_templates_difficulty_tag;
ALTER TABLE exercise_templates DROP COLUMN IF EXISTS difficulty_tag_axis_id;

ALTER TABLE exercise_templates
    ADD CONSTRAINT fk_exercise_templates_difficulty_tag
    FOREIGN KEY (difficulty_tag_id) REFERENCES tags(id)
    ON DELETE RESTRICT;

ALTER TABLE tags DROP CONSTRAINT IF EXISTS uq_tags_id_axis;
