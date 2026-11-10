-- ============================================================
-- Seed: 0061_bull_500_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Bull 500 v1: one seat races to 500
-- points; every visit starts locked, a bull unlocks it and scores
-- nothing, and only the 20 then scores (single 20, double 40,
-- treble 60). Without this seed there is no game type, ruleset
-- version, or preset to start a session from — POST /api/sessions
-- has nothing to look up for BULL_500_V1.
--
-- UUID allocation (continues the 0003 range, next after 0058's
-- Fives rows):
-- - 0198f000-...-000000000012 game_types              (BULL_500)
-- - 0198f100-...-000000000029 ruleset_versions        (BULL_500_V1)
-- - 0198f300-...-000000000020 configuration_templates (Bull 500)
--
-- Configuration JSONB follows the ruleset configuration schema
-- (app/src/lib/game/rulesets/types.ts) — Bull500Config is a strict
-- object of two locked literals, so the preset carries
-- `{"target": 500, "live_number": 20}`.
--
-- No game_type_features mapping: v1 has no duration or opponent
-- toggle, as 0041 Baseball.
--
-- Capability: BULL_500_V1 + RECREATIONAL + DETAILED_DARTS and
-- BULL_500_V1 + ANALYTICS + VISUAL_BOARD are declared in
-- seeds/0007_ruleset_version_capabilities.sql, the running ledger.
-- verification/0061_bull_500_capability_checks.sql asserts them.
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
        '0198f000-0000-7000-8000-000000000012',
        'BULL_500',
        'Bull 500',
        'Hit the bull, then score on the 20. Each visit starts locked; a bull unlocks it; first to 500 points.',
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
        '0198f100-0000-7000-8000-000000000029',
        '0198f000-0000-7000-8000-000000000012',
        'BULL_500_V1',
        1,
        'Initial Bull 500 ruleset: one seat, target 500 on the 20, a bull unlocks each visit and scores nothing; the game ends at the close of the visit that reaches 500.',
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
        '0198f300-0000-7000-8000-000000000020',
        '0198f000-0000-7000-8000-000000000012',
        NULL,
        'Bull 500',
        'Target 500, a bull unlocks the 20, one seat.',
        '{"target": 500, "live_number": 20}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
