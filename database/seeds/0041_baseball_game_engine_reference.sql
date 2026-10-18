-- ============================================================
-- Seed: 0041_baseball_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Baseball Darts v1: a solo nine-inning
-- run — inning n aims at number n, three darts an inning, a single
-- scores 1 run, a double 2, a treble 3, anything else 0. Without
-- this seed there is no game type, ruleset version, or preset to
-- start a session from — POST /api/sessions has nothing to look up
-- for BASEBALL_V1.
--
-- UUID allocation (continues the 0003 range, next after 0037's
-- 501_V2 rows and 0034's Tactics game type):
-- - 0198f000-...-00000000000c game_types              (BASEBALL)
-- - 0198f100-...-000000000018 ruleset_versions        (BASEBALL_V1)
-- - 0198f300-...-00000000001a configuration_templates (Baseball Darts — Nine Innings)
--
-- Configuration JSONB follows the ruleset configuration schema
-- (app/src/lib/game/rulesets/types.ts) — BaseballConfig is an
-- empty `.strict()` object: v1 locks nine innings, runs by ring
-- and the solo seat, so its one preset's configuration is `{}`.
--
-- No game_type_features mapping: v1 is single-player only, with no
-- duration or opponent toggle, as 0034 Tactics.
--
-- Capability: BASEBALL_V1 + RECREATIONAL + DETAILED_DARTS and
-- BASEBALL_V1 + ANALYTICS + VISUAL_BOARD are declared in
-- seeds/0007_ruleset_version_capabilities.sql, the running ledger.
-- verification/0041_baseball_capability_checks.sql asserts them.
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
        '0198f000-0000-7000-8000-00000000000c',
        'BASEBALL',
        'Baseball Darts',
        'Nine innings, three darts each: inning 1 aims at the 1, inning 9 at the 9. On the inning''s number a single scores 1 run, a double 2, a treble 3; any other number or the bull scores nothing. Most runs wins — 81 is a perfect game.',
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
        '0198f100-0000-7000-8000-000000000018',
        '0198f000-0000-7000-8000-00000000000c',
        'BASEBALL_V1',
        1,
        'Initial Baseball Darts ruleset: solo, nine innings on 1-9, three darts each, runs 1/2/3 by ring on the inning''s number, no bull, ends after inning 9.',
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
        '0198f300-0000-7000-8000-00000000001a',
        '0198f000-0000-7000-8000-00000000000c',
        NULL,
        'Baseball Darts — Nine Innings',
        'Innings 1 to 9, runs by the ring, solo.',
        '{}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
