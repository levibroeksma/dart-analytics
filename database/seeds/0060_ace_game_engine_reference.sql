-- ============================================================
-- Seed: 0060_ace_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Ace v1: two to four seats play a fixed
-- number of rounds; each round the app draws one target (1-20 or
-- the bull) and every seat throws a visit at it. Only darts on the
-- target score: single 1, double 2, treble 3; outer bull 4, inner
-- bull 6. Highest total wins; equal totals share it. Without this
-- seed there is no game type, ruleset version, or preset to start
-- a session from — POST /api/sessions has nothing to look up for
-- ACE_V1.
--
-- UUID allocation (continues the 0003 range, next after 0058's
-- Fives rows):
-- - 0198f000-...-000000000012 game_types              (ACE)
-- - 0198f100-...-000000000029 ruleset_versions        (ACE_V1)
-- - 0198f300-...-000000000020 configuration_templates (Ace)
--
-- Configuration JSONB follows the ruleset configuration schema
-- (app/src/lib/game/rulesets/types.ts) — AceConfig is `rounds`
-- (3-12) and `drawSeed`. The preset carries `rounds` only: the
-- draw seed is minted per game and sent as a config override, as
-- Random Checkout's is (D424), so no template can fix the draws.
--
-- No game_type_features mapping: v1 has no duration or opponent
-- toggle, as 0058 Fives.
--
-- Capability: ACE_V1 + RECREATIONAL + DETAILED_DARTS and
-- ACE_V1 + ANALYTICS + VISUAL_BOARD are declared in
-- seeds/0007_ruleset_version_capabilities.sql, the running ledger.
-- verification/0060_ace_capability_checks.sql asserts them.
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
        'ACE',
        'Ace',
        'A surprise-target scoring game. Each round the app draws one target; every seat throws a visit at it and only darts on the target score. Highest total after the last round wins.',
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
        'ACE_V1',
        1,
        'Initial Ace ruleset: 2-4 seats, 3-12 rounds, a seeded target per round from 1-20 and the bull, Ace points by ring, highest total wins, equal totals share the win.',
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
        'Ace',
        'Eight rounds, a drawn target each round, 2-4 seats.',
        '{"rounds": 8}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
