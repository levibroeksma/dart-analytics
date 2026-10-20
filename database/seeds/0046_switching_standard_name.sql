-- database/seeds/0046_switching_standard_name.sql
--
-- ============================================================
-- Seed: 0046_switching_standard_name.sql
--
-- Purpose:
-- Rename the Switching exercise's first system template
-- (0199b000-0000-7000-8000-000000000002, seed 0017) from
-- "Switching" to "Standard", and rewrite its description to
-- describe that config rather than the exercise.
--
-- Since 0044 the SWITCHING type carries two configs, and the
-- routine builder renders one card per exercise type with a row
-- per template. The card is titled "Switching" (the type's
-- name), so a template still called "Switching" gave the player
-- a card headed Switching with rows "Chain" and "Switching" and
-- no way to tell which row was which config. The rows have to
-- read Standard and Chain
-- (docs/superpowers/specs/2026-10-19-switching-merge-design.md,
-- "What the player sees"). The blurb on the card stays the
-- type's description (seed 0045); this row's description is the
-- per-config line under the row.
--
-- Safe for statistics. v_stats_routine_step_facts
-- (migration 0045) fingerprints a step as
-- md5((element - 'sequenceNumber')::text) over the snapshot
-- resolveStep writes (app/src/services/training-session.service.ts):
-- sequenceNumber, exerciseTypeKey, exerciseRulesetVersionKey,
-- gameTypeKey, gameRulesetVersionKey, durationSeconds and
-- configuration. exercise_templates.name and .description are
-- not in that snapshot and not in the fingerprint, so renaming
-- the template is fingerprint-neutral and no player's Balanced
-- Training trend restarts. What would restart it is a changed
-- default_configuration or a changed ruleset pin, and this seed
-- touches neither.
--
-- A new seed rather than an edit to 0017: seeds are idempotent
-- and the row already exists, so 0017's INSERT ... ON CONFLICT
-- (id) DO NOTHING would never update it on any re-run. The
-- shape follows 0045_switching_description.sql — a
-- primary-key-targeted UPDATE in a later-numbered file, so
-- filename order puts it after the INSERT it corrects.
--
-- Idempotent: the UPDATE is guarded by IS DISTINCT FROM on both
-- columns, so the second pass of `npm run db:seed` (D248)
-- matches no row and leaves updated_at alone. updated_at is set
-- explicitly (no column DEFAULTs).
-- ============================================================
BEGIN;

UPDATE exercise_templates
SET name = 'Standard',
	description = 'One dart at each target in turn, every dart scored by the ring it hits: single 1, double 2, treble 3.',
	updated_at = now()
WHERE id = '0199b000-0000-7000-8000-000000000002'
	AND (
		name IS DISTINCT FROM 'Standard'
		OR description IS DISTINCT FROM 'One dart at each target in turn, every dart scored by the ring it hits: single 1, double 2, treble 3.'
	);

COMMIT;
