-- database/seeds/0026_warm_up_advanced_template.sql
--
-- ============================================================
-- Seed: 0026_warm_up_advanced_template.sql
--
-- Purpose:
-- Insert a second WARM_UP system template, "Warm-Up Advanced":
-- the same five sections as Warm-Up (0015/0017), each narrowed
-- to one number — 20, 3, 6, 11 — then the bull, so the board
-- highlight outlines a single slice. Rules:
-- docs/game-rules/training/exercises/warm-up.md.
--
-- Same WARM_UP_V1 ruleset, so no engine or type change; the
-- template pins it directly (migration 0035's column), resolved
-- by implementation_key like 0019. No routine is seeded: it
-- reaches players through v_exercise_template_catalog.
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
VALUES (
		'0199b000-0000-7000-8000-00000000000a',
		'0199a000-0000-7000-8000-000000000002',
		(
			SELECT id FROM exercise_ruleset_versions
			WHERE implementation_key = 'WARM_UP_V1'
		),
		NULL,
		'Warm-Up Advanced',
		'Five timed sections on single numbers — 20, 3, 6, 11 — then the bull.',
		'{"phases":[
			{"name":"Upper","targets":[20],"weight":1},
			{"name":"Lower","targets":[3],"weight":1},
			{"name":"Right","targets":[6],"weight":1},
			{"name":"Left","targets":[11],"weight":1},
			{"name":"Bull","targets":[25],"weight":1}
		]}'::jsonb,
		TRUE,
		now(),
		now()
	) ON CONFLICT (id) DO NOTHING;

COMMIT;
