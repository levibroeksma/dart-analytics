-- database/seeds/0044_switching_chain.sql
--
-- ============================================================
-- Seed: 0044_switching_chain.sql
--
-- Purpose:
-- Give the existing SWITCHING exercise type its second ruleset
-- version, SWITCHING_CHAIN_V1, and the "Chain" system template
-- that pins it, so the routine builder offers Switching twice —
-- once per config — under one exercise type. Chain is the
-- former standalone exercise, merged back into Switching: the
-- mode rides on the ruleset version key, not on the step
-- configuration.
--
-- The existing Standard template
-- (0199b000-0000-7000-8000-000000000002, seed 0017, pinned to
-- SWITCHING_V1 by seed 0019) is NOT touched beyond
-- difficulty_tag_id. What a change there would cost is exactly
-- what the step fingerprint reads, and no more:
-- v_stats_routine_step_facts (migration 0045) hashes
-- md5((element - 'sequenceNumber')::text) over the snapshot
-- resolveStep writes
-- (app/src/services/training-session.service.ts) —
-- exerciseTypeKey, exerciseRulesetVersionKey, gameTypeKey,
-- gameRulesetVersionKey, durationSeconds and configuration. So
-- a changed default_configuration or a changed ruleset pin
-- would restart every player's Balanced Training trend, while
-- name and description are NOT in the snapshot and are safe to
-- change. Seed 0046 does change both, renaming this template to
-- "Standard" so the card's two rows read Standard and Chain.
--
-- exercise_ruleset_versions has no unique on
-- (exercise_type_id, version_number) — only
-- uq_exercise_ruleset_versions_implementation_key and
-- uq_exercise_ruleset_versions_type_id (exercise_type_id, id),
-- the latter backing exercise_templates' composite FK. The
-- version number is therefore descriptive: 2 reads as "the
-- second ruleset of this type", after SWITCHING_V1.
--
-- The template resolves its ruleset by implementation_key like
-- 0019/0039/0040, never by a hard-coded id.
--
-- The difficulty UPDATEs follow
-- 0043_exercise_template_difficulty.sql: the tag is resolved by
-- (axis key, tag key), the row by primary key. Switching's two
-- configs are the labelled pair that D473's grammar allows —
-- BEGINNER (Standard) and INTERMEDIATE (Chain). Runs after
-- 0042_catalog_tags.sql (filename order), which writes the
-- DIFFICULTY tags.
--
-- Idempotent: ON CONFLICT (id) DO NOTHING inserts plus
-- primary-key-targeted UPDATEs, so the second pass of
-- `npm run db:seed` (D248) changes nothing.
-- ============================================================
BEGIN;

INSERT INTO exercise_ruleset_versions (
		id,
		exercise_type_id,
		implementation_key,
		version_number,
		description,
		created_at
	)
VALUES (
		'0199a100-0000-7000-8000-00000000000e',
		'0199a000-0000-7000-8000-000000000003',
		'SWITCHING_CHAIN_V1',
		2,
		'Chain ruleset for Switching: three targets in order; Target Scoring points; a hit switches, a miss restarts.',
		now()
	) ON CONFLICT (id) DO NOTHING;

INSERT INTO exercise_templates (
		id,
		exercise_type_id,
		exercise_ruleset_version_id,
		game_type_id,
		name,
		description,
		default_configuration,
		is_system_template,
		created_at,
		updated_at
	)
VALUES (
		'0199b000-0000-7000-8000-000000000015',
		'0199a000-0000-7000-8000-000000000003',
		(
			SELECT id FROM exercise_ruleset_versions
			WHERE implementation_key = 'SWITCHING_CHAIN_V1'
		),
		NULL,
		'Chain',
		'How high a chain can you build switching 20, 19, 18?',
		'{"targets":[20,19,18]}'::jsonb,
		TRUE,
		now(),
		now()
	) ON CONFLICT (id) DO NOTHING;

-- SWITCHING (rules file still owed; its routine-step Difficulty
-- row will read BEGINNER (Standard), INTERMEDIATE (Chain)):
-- - 0199b000-...-002  Standard (seed 0017, renamed by 0046) -> BEGINNER
-- - 0199b000-...-015  Chain    (above)                      -> INTERMEDIATE
UPDATE exercise_templates SET difficulty_tag_id = (SELECT t.id FROM tags t JOIN tag_axes a ON a.id = t.tag_axis_id WHERE a.implementation_key = 'DIFFICULTY' AND t.implementation_key = 'BEGINNER') WHERE id = '0199b000-0000-7000-8000-000000000002';
UPDATE exercise_templates SET difficulty_tag_id = (SELECT t.id FROM tags t JOIN tag_axes a ON a.id = t.tag_axis_id WHERE a.implementation_key = 'DIFFICULTY' AND t.implementation_key = 'INTERMEDIATE') WHERE id = '0199b000-0000-7000-8000-000000000015';

COMMIT;
