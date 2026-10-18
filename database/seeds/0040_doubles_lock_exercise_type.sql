-- database/seeds/0040_doubles_lock_exercise_type.sql
--
-- ============================================================
-- Seed: 0040_doubles_lock_exercise_type.sql
--
-- Purpose:
-- Insert the DOUBLES_LOCK exercise type, its v1 ruleset and the
-- Doubles Lock system template, so the exercise appears in the
-- routine builder's catalog (v_exercise_template_catalog) as a
-- routine step. Rules:
-- docs/game-rules/training/exercises/doubles-lock.md.
-- No routine is seeded: V1 is a routine step only.
--
-- The template pins its ruleset version directly (migration
-- 0035's column), resolved by implementation_key like 0019.
-- The default configuration is empty: path, lock threshold and
-- bonus are fixed in V1. Duration is the routine step's.
-- ============================================================
BEGIN;

INSERT INTO exercise_types (
		id,
		implementation_key,
		name,
		description,
		is_published,
		created_at,
		updated_at
	)
VALUES (
		'0199a000-0000-7000-8000-00000000000e',
		'DOUBLES_LOCK',
		'Doubles Lock',
		'Walk the doubles from D20 down to D1. Two or three hits lock a double for a bonus; a blank visit sends you back to your last lock. The ladder repeats until the time runs out.',
		TRUE,
		now(),
		now()
	) ON CONFLICT (id) DO NOTHING;

INSERT INTO exercise_ruleset_versions (
		id,
		exercise_type_id,
		implementation_key,
		version_number,
		description,
		created_at
	)
VALUES (
		'0199a100-0000-7000-8000-00000000000d',
		'0199a000-0000-7000-8000-00000000000e',
		'DOUBLES_LOCK_V1',
		1,
		'Initial Doubles Lock ruleset: D20 to D1; one hit advances, two lock for 50, three lock for 100; a blank visit retreats to the last lock, or D20 before one; passes repeat until time.',
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
		'0199b000-0000-7000-8000-000000000014',
		'0199a000-0000-7000-8000-00000000000e',
		(
			SELECT id FROM exercise_ruleset_versions
			WHERE implementation_key = 'DOUBLES_LOCK_V1'
		),
		NULL,
		'Doubles Lock',
		'D20 down to D1. Two hits lock a double for 50, three for 100; a blank visit falls back to your last lock.',
		'{}'::jsonb,
		TRUE,
		now(),
		now()
	) ON CONFLICT (id) DO NOTHING;

COMMIT;
