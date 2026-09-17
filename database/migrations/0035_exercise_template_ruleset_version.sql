-- ============================================================
-- Migration: 0035_exercise_template_ruleset_version.sql
--
-- Purpose:
-- Let an exercise template pin the exercise ruleset version it
-- was written against, the way the game side pins a ruleset
-- version on the session.
--
-- findRoutineTemplateSteps joined exercise_ruleset_versions on
-- exercise_type_id alone, with no version predicate (issue
-- #338). That is unambiguous only by accident: exactly one
-- version exists per type today (WARM_UP_V1, SWITCHING_V1,
-- DOUBLE_PATTERN_V1, seeds 0014/0016). The moment a second
-- version of any type is seeded the join fans out — every step
-- row of that type duplicates and the session pins to whichever
-- version the row order happens to surface. It would surface as
-- duplicated steps in a routine, not as an error.
--
-- The version belongs on exercise_templates rather than
-- routine_steps: default_configuration and the ruleset version
-- that defines its shape must agree, and both are the
-- template's. A per-step override would let one step's config
-- shape diverge from its own template's.
--
-- The foreign key is composite, not simple, so a template
-- cannot pin a ruleset version belonging to a different
-- exercise type — the same shape fk_sessions_capability uses
-- (migration 0020). It needs a UNIQUE on the referenced pair;
-- (exercise_type_id, id) is already unique by way of the
-- primary key, so the constraint adds no new restriction, only
-- a referenceable target.
--
-- The column is NULLABLE and stays so. A GAME template pins a
-- game ruleset version on its session instead and has no
-- exercise ruleset at all (the Finishing step of Balanced
-- Training), and MATCH SIMPLE skips FK validation when any
-- column of the pair is NULL. "A non-game template must pin a
-- version" is asserted in startTraining, which refuses to open
-- an activity whose step resolves no validator, rather than by
-- a CHECK that would hardcode game-backed ⇔ no-exercise-ruleset
-- into the schema.
--
-- PREREQUISITE: none to apply. Existing rows take NULL. The
-- system templates are backfilled by
-- seeds/0019_exercise_template_ruleset_versions.sql, which must
-- run before a routine using them can start.
-- ============================================================

-- migrate:up
ALTER TABLE exercise_ruleset_versions
    ADD CONSTRAINT uq_exercise_ruleset_versions_type_id UNIQUE (exercise_type_id, id);

ALTER TABLE exercise_templates
    ADD COLUMN exercise_ruleset_version_id UUID;

ALTER TABLE exercise_templates
    ADD CONSTRAINT fk_exercise_templates_ruleset_version
    FOREIGN KEY (exercise_type_id, exercise_ruleset_version_id)
    REFERENCES exercise_ruleset_versions (exercise_type_id, id)
    ON DELETE RESTRICT;

COMMENT ON COLUMN exercise_templates.exercise_ruleset_version_id IS 'Exercise ruleset version this template''s default_configuration was written against. NULL for a GAME template, which pins a game ruleset version on the session instead.';

-- migrate:down
ALTER TABLE exercise_templates
    DROP CONSTRAINT IF EXISTS fk_exercise_templates_ruleset_version;

ALTER TABLE exercise_templates
    DROP COLUMN IF EXISTS exercise_ruleset_version_id;

ALTER TABLE exercise_ruleset_versions
    DROP CONSTRAINT IF EXISTS uq_exercise_ruleset_versions_type_id;
