-- database/seeds/0059_doubles_lock_variants.sql
--
-- ============================================================
-- Seed: 0059_doubles_lock_variants.sql
--
-- Purpose:
-- Add the Even Doubles Only and Ascending Order variants of Doubles Lock
-- as system templates. They pin the existing DOUBLES_LOCK_V1 ruleset:
-- the variants are configuration (path order and doubles) of that
-- ruleset, so no ruleset version row is added. Rules:
-- docs/game-rules/training/exercises/doubles-lock.md.
-- Difficulty stays NULL: the type labels a single routine-step difficulty.
-- ============================================================
BEGIN;

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
VALUES
	(
		'0199b000-0000-7000-8000-000000000018',
		'0199a000-0000-7000-8000-00000000000e',
		(SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'DOUBLES_LOCK_V1'),
		NULL,
		'Doubles Lock: Even',
		'D20, D18 … D2. Two hits lock a double for 50, three for 100; a blank visit falls back to your last lock.',
		'{"doubles":"EVEN"}'::jsonb,
		TRUE,
		now(),
		now()
	),
	(
		'0199b000-0000-7000-8000-000000000019',
		'0199a000-0000-7000-8000-00000000000e',
		(SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'DOUBLES_LOCK_V1'),
		NULL,
		'Doubles Lock: Ascending',
		'D1 up to D20. Two hits lock a double for 50, three for 100; a blank visit falls back to your last lock.',
		'{"order":"ASCENDING"}'::jsonb,
		TRUE,
		now(),
		now()
	),
	(
		'0199b000-0000-7000-8000-00000000001a',
		'0199a000-0000-7000-8000-00000000000e',
		(SELECT id FROM exercise_ruleset_versions WHERE implementation_key = 'DOUBLES_LOCK_V1'),
		NULL,
		'Doubles Lock: Even Ascending',
		'D2, D4 … D20. Two hits lock a double for 50, three for 100; a blank visit falls back to your last lock.',
		'{"order":"ASCENDING","doubles":"EVEN"}'::jsonb,
		TRUE,
		now(),
		now()
	)
	ON CONFLICT (id) DO NOTHING;

COMMIT;
