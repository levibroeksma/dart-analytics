-- database/seeds/0045_switching_description.sql
--
-- ============================================================
-- Seed: 0045_switching_description.sql
--
-- Purpose:
-- Rewrite exercise_types.description for SWITCHING. Seed 0016
-- set it to "Cycles a fixed target list dart by dart, scored by
-- zone." — a description of the Standard config alone. Since
-- 0044 the type ships two ruleset versions (SWITCHING_V1 =
-- Standard, SWITCHING_CHAIN_V1 = Chain) and the type's
-- description is the blurb on the one Switching card that
-- carries both configs, so it has to describe the exercise
-- rather than one of its configs. The rules file is
-- docs/game-rules/training/exercises/switching.md.
--
-- A new seed rather than an edit to 0016: seeds are idempotent
-- and the row already exists, so 0016's INSERT ... ON CONFLICT
-- (id) DO NOTHING would never update it on any re-run. The
-- shape follows 0043_exercise_template_difficulty.sql — a
-- primary-key-targeted UPDATE, written in a later-numbered file
-- so filename order puts it after the INSERT it corrects.
--
-- The per-template descriptions are untouched here: the
-- Standard template (0199b000-...-002, seed 0017, renamed and
-- redescribed by seed 0046) and the "Chain" template
-- (0199b000-...-015, seed 0044) each name their own config.
-- Neither name nor description is in the stats step
-- fingerprint, which hashes only the snapshot resolveStep
-- writes (see seed 0046's header).
--
-- Idempotent: a primary-key-targeted UPDATE to a constant
-- value, guarded by IS DISTINCT FROM so the second pass of
-- `npm run db:seed` (D248) matches no row and leaves updated_at
-- alone. updated_at is set explicitly (no column DEFAULTs).
-- ============================================================
BEGIN;

UPDATE exercise_types
SET description = 'Switch the aim from target to target without losing rhythm: Standard scores every dart by the ring it hits, Chain asks for an unbroken run and resets on a miss.',
	updated_at = now()
WHERE id = '0199a000-0000-7000-8000-000000000003'
	AND description IS DISTINCT FROM 'Switch the aim from target to target without losing rhythm: Standard scores every dart by the ring it hits, Chain asks for an unbroken run and resets on a miss.';

COMMIT;
