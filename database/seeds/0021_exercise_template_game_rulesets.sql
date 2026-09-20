-- database/seeds/0021_exercise_template_game_rulesets.sql
-- Backfills exercise_templates.game_ruleset_version_id (migration 0039)
-- for the Finishing system template: TUOD_V1. UPDATE in place (0019
-- shape), idempotent, resolved by implementation_key.
BEGIN;

UPDATE exercise_templates
SET game_ruleset_version_id = (
        SELECT rv.id FROM ruleset_versions rv
        JOIN game_types gt ON gt.id = rv.game_type_id
        WHERE gt.implementation_key = 'TUOD' AND rv.implementation_key = 'TUOD_V1'
    ),
    updated_at = now()
WHERE id = '0199b000-0000-7000-8000-000000000004';

COMMIT;
