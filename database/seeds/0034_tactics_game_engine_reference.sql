-- ============================================================
-- Seed: 0034_tactics_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Tactics v1: a solo close-out drill —
-- close 20, 19, 18, 17, 16, 15, the bull, Doubles and Triples in
-- as few darts as possible (three marks each, overflow discarded,
-- the closing dart ends the run). Without this seed there is no game type,
-- ruleset version, or preset to start a session from —
-- POST /api/sessions has nothing to look up for TACTICS_V1.
--
-- UUID allocation (continues the 0003 range, next after 0033's
-- Cricket rows):
-- - 0198f000-...-00000000000b game_types              (TACTICS)
-- - 0198f100-...-000000000016 ruleset_versions        (TACTICS_V1)
-- - 0198f300-...-000000000018 configuration_templates (TACTICS)
--
-- Configuration JSONB follows the ruleset configuration schema
-- (app/src/lib/game/rulesets/types.ts) — TacticsConfig is a
-- genuinely empty `.strict()` object: v1 locks every rule
-- (objectives, marks, D/T rule, solo seat) with nothing left
-- to configure, so its one preset's configuration is `{}`.
--
-- No game_type_features mapping: v1 is single-player only, and
-- there is no duration or opponent toggle to configure,
-- mirroring 0033's Cricket reasoning.
--
-- Capability: TACTICS_V1 + RECREATIONAL + DETAILED_DARTS and
-- TACTICS_V1 + ANALYTICS + VISUAL_BOARD are declared in
-- seeds/0007_ruleset_version_capabilities.sql, not here — 0007
-- is the single running ledger every ruleset's capability rows
-- are appended to.
-- verification/0034_tactics_capability_checks.sql asserts the
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
        '0198f000-0000-7000-8000-00000000000b',
        'TACTICS',
        'Tactics',
        'Close 20, 19, 18, 17, 16, 15, the bull, Doubles and Triples — three marks each — in as few darts as you can. Singles mark once, doubles twice, trebles three times; the outer bull marks once, the bullseye twice. A double or treble that cannot mark its number counts toward Doubles or Triples.',
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
        '0198f100-0000-7000-8000-000000000016',
        '0198f000-0000-7000-8000-00000000000b',
        'TACTICS_V1',
        1,
        'Initial Tactics ruleset: solo close-out of 20-15, BULL, DOUBLES and TRIPLES, 3 marks to close, overflow discarded, the closing dart ends the run.',
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
        '0198f300-0000-7000-8000-000000000018',
        '0198f000-0000-7000-8000-00000000000b',
        NULL,
        'Tactics — Classic',
        '20 through 15, the bull, Doubles and Triples, solo close-out.',
        '{}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
