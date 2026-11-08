-- ============================================================
-- Seed: 0058_fives_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Fives v1: two to four seats race to
-- exactly 51 fives points; a visit total divisible by 5 scores
-- total / 5, an off-board dart voids the visit, and a visit that
-- would pass 51 is a bust. Without this seed there is no game
-- type, ruleset version, or preset to start a session from —
-- POST /api/sessions has nothing to look up for FIVES_V1.
--
-- UUID allocation (continues the 0003 range, next after 0057's
-- Prisoner rows):
-- - 0198f000-...-000000000011 game_types              (FIVES)
-- - 0198f100-...-000000000028 ruleset_versions        (FIVES_V1)
-- - 0198f300-...-00000000001f configuration_templates (Fives)
--
-- Configuration JSONB follows the ruleset configuration schema
-- (app/src/lib/game/rulesets/types.ts) — FivesConfig is an empty
-- strict object, so the preset carries `{}`.
--
-- No game_type_features mapping: v1 has no duration or opponent
-- toggle, as 0041 Baseball.
--
-- Capability: FIVES_V1 + RECREATIONAL + DETAILED_DARTS and
-- FIVES_V1 + ANALYTICS + VISUAL_BOARD are declared in
-- seeds/0007_ruleset_version_capabilities.sql, the running ledger.
-- verification/0058_fives_capability_checks.sql asserts them.
-- ============================================================
BEGIN;
-- ============================================================
-- Game type
-- ============================================================
INSERT INTO game_types (
        id,
        implementation_key,
        name,
        description,
        is_published,
        created_at,
        updated_at
    )
VALUES (
        '0198f000-0000-7000-8000-000000000011',
        'FIVES',
        'Fives',
        'First to exactly 51 fives points. A visit total divisible by 5 scores total / 5; an off-board dart voids the visit; passing 51 is a bust.',
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Ruleset version
-- ============================================================
INSERT INTO ruleset_versions (
        id,
        game_type_id,
        implementation_key,
        version_number,
        description,
        created_at
    )
VALUES (
        '0198f100-0000-7000-8000-000000000028',
        '0198f000-0000-7000-8000-000000000011',
        'FIVES_V1',
        1,
        'Initial Fives ruleset: 2-4 seats, target 51, fives points, void on an off-board dart, bust on overshoot; the leg ends when a seat reaches 51.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Configuration preset
-- ============================================================
INSERT INTO configuration_templates (
        id,
        game_type_id,
        player_id,
        name,
        description,
        configuration,
        is_system_template,
        created_at,
        updated_at
    )
VALUES (
        '0198f300-0000-7000-8000-00000000001f',
        '0198f000-0000-7000-8000-000000000011',
        NULL,
        'Fives',
        'Target 51, void on an off-board dart, bust on overshoot, 2-4 seats.',
        '{}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
