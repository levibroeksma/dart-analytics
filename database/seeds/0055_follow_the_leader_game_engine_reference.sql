-- ============================================================
-- Seed: 0055_follow_the_leader_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Follow the Leader v1: two seats, three
-- lives each. The leader's dart sets a target bed (number and
-- ring, or one of the two bulls); every other seat throws up to
-- three darts to hit that exact bed or lose a life, and may set
-- a new target with its spare darts after a match. A leader
-- whose every opponent failed may keep the target. Last seat
-- with a life wins. Without this seed there is no game type,
-- ruleset version, or preset to start a session from —
-- POST /api/sessions has nothing to look up for
-- FOLLOW_THE_LEADER_V1.
--
-- UUID allocation (continues the 0003 range, next after 0054's
-- Killer rows):
-- - 0198f000-...-00000000000e game_types              (FOLLOW_THE_LEADER)
-- - 0198f100-...-000000000025 ruleset_versions        (FOLLOW_THE_LEADER_V1)
-- - 0198f300-...-00000000001c configuration_templates (Follow the Leader — Three Lives)
--
-- Configuration JSONB follows the ruleset configuration schema
-- (app/src/lib/game/rulesets/types.ts) — FollowTheLeaderConfig:
-- `lives` is locked at 3, so the preset carries `{"lives": 3}`.
--
-- No game_type_features mapping: v1 has no duration or opponent
-- toggle, as 0054 Killer.
--
-- Capability: FOLLOW_THE_LEADER_V1 + RECREATIONAL + DETAILED_DARTS
-- and FOLLOW_THE_LEADER_V1 + ANALYTICS + VISUAL_BOARD are declared
-- in seeds/0007_ruleset_version_capabilities.sql, the running
-- ledger. verification/0055_follow_the_leader_capability_checks.sql
-- asserts them.
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
        '0198f000-0000-7000-8000-00000000000e',
        'FOLLOW_THE_LEADER',
        'Follow the Leader',
        'The leader sets a target bed; every other seat must hit that exact bed with up to three darts or lose a life, and a match with darts to spare can set a new target. Three lives each; the last seat with a life wins.',
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
        '0198f100-0000-7000-8000-000000000025',
        '0198f000-0000-7000-8000-00000000000e',
        'FOLLOW_THE_LEADER_V1',
        1,
        'Initial Follow the Leader ruleset: two seats, three lives, exact-bed match; seat 1 opens with one dart, a leader sets with one dart, an off-board setting dart is thrown again; a matcher may stop after a match or set with its spare darts, and loses a life on no match or an off-board last dart; a leader may keep when every other seat failed; last seat standing wins.',
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
        '0198f300-0000-7000-8000-00000000001c',
        '0198f000-0000-7000-8000-00000000000e',
        NULL,
        'Follow the Leader — Three Lives',
        'Three lives each, exact-bed match, two seats.',
        '{"lives": 3}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
