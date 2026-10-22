-- database/seeds/0048_snakes_ladders_exercise_type.sql
--
-- ============================================================
-- Seed: 0048_snakes_ladders_exercise_type.sql
--
-- Purpose:
-- Insert the DOUBLES_SNAKES_LADDERS exercise type, its v1 ruleset
-- and the Doubles Snakes & Ladders system template, so the
-- exercise appears in the routine builder's catalog
-- (v_exercise_template_catalog) as a routine step. Rules:
-- docs/game-rules/training/exercises/doubles-snakes-and-ladders.md.
-- No routine is seeded: V1 is a routine step only.
--
-- The template pins its ruleset version directly (migration
-- 0035's column), resolved by implementation_key like 0019.
-- The default configuration is empty: the levels, moves and
-- finish are fixed in V1. Duration is the routine step's.
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
		'0199a000-0000-7000-8000-000000000010',
		'DOUBLES_SNAKES_LADDERS',
		'Doubles Snakes & Ladders',
		'Climb the doubles from D1 to D20, then the bullseye. Three hits in a visit go up a level, two stay, one goes back a level, none go back two. Three bullseyes in one visit finish the run.',
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
		'0199a100-0000-7000-8000-000000000010',
		'0199a000-0000-7000-8000-000000000010',
		'DOUBLES_SNAKES_LADDERS_V1',
		1,
		'Initial Doubles Snakes & Ladders ruleset: D1 to D20 then the bullseye; 0 hits back two, 1 back one, 2 stay, 3 up one, floor D1; three bullseyes in one visit finish.',
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
		'0199b000-0000-7000-8000-000000000017',
		'0199a000-0000-7000-8000-000000000010',
		(
			SELECT id FROM exercise_ruleset_versions
			WHERE implementation_key = 'DOUBLES_SNAKES_LADDERS_V1'
		),
		NULL,
		'Doubles Snakes & Ladders',
		'Climb the doubles ladder; three bullseyes finish.',
		'{}'::jsonb,
		TRUE,
		now(),
		now()
	) ON CONFLICT (id) DO NOTHING;

COMMIT;
