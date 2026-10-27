-- ============================================================
-- Seed: 0054_killer_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Killer v1: two seats, each owning a
-- number 1-20 chosen at setup; three lives each; only doubles
-- count. Hit your own double to become a Killer (a second hit
-- loses it); a Killer's hit on another seat's double takes one
-- life; last seat with a life wins. Without this seed there is
-- no game type, ruleset version, or preset to start a session
-- from — POST /api/sessions has nothing to look up for KILLER_V1.
--
-- UUID allocation (continues the 0003 range, next after 0041's
-- Baseball rows and 0053's SHANGHAI_V3):
-- - 0198f000-...-00000000000d game_types              (KILLER)
-- - 0198f100-...-000000000024 ruleset_versions        (KILLER_V1)
-- - 0198f300-...-00000000001b configuration_templates (Killer — Three Lives)
--
-- Configuration JSONB follows the ruleset configuration schema
-- (app/src/lib/game/rulesets/types.ts) — KillerConfig: `lives`
-- is locked at 3 and `seat_numbers` is the setup's own per-seat
-- choice, supplied through configOverrides, so the preset carries
-- only `{"lives": 3}`.
--
-- No game_type_features mapping: v1 has no duration or opponent
-- toggle, as 0041 Baseball.
--
-- Capability: KILLER_V1 + RECREATIONAL + DETAILED_DARTS and
-- KILLER_V1 + ANALYTICS + VISUAL_BOARD are declared in
-- seeds/0007_ruleset_version_capabilities.sql, the running ledger.
-- verification/0054_killer_capability_checks.sql asserts them.
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
        '0198f000-0000-7000-8000-00000000000d',
        'KILLER',
        'Killer',
        'Each seat owns a number. Hit your own double to become a Killer, then hit the other seat''s double to take its lives. Only doubles count; three lives each; the last seat with a life wins.',
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
        '0198f100-0000-7000-8000-000000000024',
        '0198f000-0000-7000-8000-00000000000d',
        'KILLER_V1',
        1,
        'Initial Killer ruleset: two seats, player-chosen numbers 1-20, three lives, doubles only; own double toggles Killer status, a Killer''s hit on another seat''s double takes one life; last seat standing wins.',
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
        '0198f300-0000-7000-8000-00000000001b',
        '0198f000-0000-7000-8000-00000000000d',
        NULL,
        'Killer — Three Lives',
        'Three lives each, doubles only, two seats.',
        '{"lives": 3}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
