-- ============================================================
-- Seed: 0033_cricket_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Cricket v1: a solo close-out drill —
-- close 20, 19, 18, 17, 16, 15 and the bull in as few darts as
-- possible (three marks each, overflow discarded, the closing
-- dart ends the run). Without this seed there is no game type,
-- ruleset version, or preset to start a session from —
-- POST /api/sessions has nothing to look up for CRICKET_V1.
--
-- UUID allocation (continues the 0003 range, next after 0010's
-- Around the Clock rows and 0027's V2 preset):
-- - 0198f000-...-00000000000a game_types              (CRICKET)
-- - 0198f100-...-000000000015 ruleset_versions        (CRICKET_V1)
-- - 0198f300-...-000000000017 configuration_templates (CRICKET)
--
-- Configuration JSONB follows the ruleset configuration schema
-- (app/src/lib/game/rulesets/types.ts) — CricketConfig is a
-- genuinely empty `.strict()` object: v1 locks every rule
-- (objectives, marks, solo seat) with nothing left to
-- configure, so its one preset's configuration is `{}`.
--
-- No game_type_features mapping: v1 is single-player only, and
-- there is no duration or opponent toggle to configure,
-- mirroring 0010's Around the Clock reasoning.
--
-- Capability: CRICKET_V1 + RECREATIONAL + DETAILED_DARTS and
-- CRICKET_V1 + ANALYTICS + VISUAL_BOARD are declared in
-- seeds/0007_ruleset_version_capabilities.sql, not here — 0007
-- is the single running ledger every ruleset's capability rows
-- are appended to.
-- verification/0033_cricket_capability_checks.sql asserts the
-- resulting rows.
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
        '0198f000-0000-7000-8000-00000000000a',
        'CRICKET',
        'Cricket',
        'Close 20, 19, 18, 17, 16, 15 and the bull — three marks each — in as few darts as you can. Singles mark once, doubles twice, trebles three times; the outer bull marks once, the bullseye twice.',
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
        '0198f100-0000-7000-8000-000000000015',
        '0198f000-0000-7000-8000-00000000000a',
        'CRICKET_V1',
        1,
        'Initial Cricket ruleset: solo close-out of 20-15 and BULL, 3 marks to close, overflow discarded, the closing dart ends the run.',
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
        '0198f300-0000-7000-8000-000000000017',
        '0198f000-0000-7000-8000-00000000000a',
        NULL,
        'Cricket — Classic',
        '20 through 15 and the bull, solo close-out.',
        '{}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
