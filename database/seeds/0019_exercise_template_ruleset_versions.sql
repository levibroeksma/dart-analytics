-- database/seeds/0019_exercise_template_ruleset_versions.sql
--
-- ============================================================
-- Seed: 0019_exercise_template_ruleset_versions.sql
--
-- Purpose:
-- Backfill exercise_templates.exercise_ruleset_version_id
-- (migration 0035) for the three non-game system templates, so
-- findRoutineTemplateSteps can join on the version instead of
-- on the exercise type alone (issue #338).
--
-- UPDATE, not an INSERT: the templates themselves are seeded by
-- 0015 and 0017 and already exist by the time this runs. This
-- is the second case of the in-place update 0017 established —
-- there is no id to conflict on for setting an existing row's
-- column. Idempotent under re-run: each UPDATE resolves to the
-- same version id whatever the column currently holds, and
-- npm run db:seed runs the whole list twice per invocation
-- (D248).
--
-- Versions are resolved by implementation_key rather than by
-- hardcoded id. The 'Finishing' template (0199b000-...-0004) is
-- deliberately absent: it is a GAME template and pins a game
-- ruleset version on its session instead.
-- ============================================================
BEGIN;

UPDATE exercise_templates
SET exercise_ruleset_version_id = (
        SELECT id FROM exercise_ruleset_versions
        WHERE implementation_key = 'WARM_UP_V1'
    ),
    updated_at = now()
WHERE id = '0199b000-0000-7000-8000-000000000001';

UPDATE exercise_templates
SET exercise_ruleset_version_id = (
        SELECT id FROM exercise_ruleset_versions
        WHERE implementation_key = 'SWITCHING_V1'
    ),
    updated_at = now()
WHERE id = '0199b000-0000-7000-8000-000000000002';

UPDATE exercise_templates
SET exercise_ruleset_version_id = (
        SELECT id FROM exercise_ruleset_versions
        WHERE implementation_key = 'DOUBLE_PATTERN_V1'
    ),
    updated_at = now()
WHERE id = '0199b000-0000-7000-8000-000000000003';

COMMIT;
