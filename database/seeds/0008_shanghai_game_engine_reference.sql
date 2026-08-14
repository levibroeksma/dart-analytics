-- ============================================================
-- Seed: 0008_shanghai_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Shanghai v1: a round-by-round target
-- game with no engine reference data yet. Without this seed
-- there is no game type, ruleset version, or preset to start a
-- session from — POST /api/sessions has nothing to look up for
-- SHANGHAI_V1.
--
-- UUID allocation (continues the 0003 range):
-- - 0198f000-...-000007 game_types              (SHANGHAI)
-- - 0198f100-...-000007 ruleset_versions        (SHANGHAI_V1)
-- - 0198f300-...-000011 configuration_templates (SHANGHAI)
--
-- Configuration JSONB follows the ruleset configuration schema
-- (app/src/lib/game/rulesets/types.ts) — ShanghaiConfig is a
-- genuinely empty `.strict()` object: v1 locks every rule (round
-- range, scoring, Shanghai instant-win) with nothing left to
-- configure, so its one preset's configuration is `{}`.
--
-- No game_type_features mapping: v1 is single-player only
-- (multiplayer is a later version per docs/game-rules/rulesets/
-- shanghai.md), and the round range is fixed at 1-20 with no
-- duration_type/duration_value to configure, so neither
-- OPPONENT_SUPPORT/DARTBOT_SUPPORT nor TIMED_MODE/ROUNDS_MODE
-- apply, mirroring 0003's Bob's 27/Doubles Training reasoning.
--
-- No exercise_templates row: nothing outside this file's own
-- configuration_templates preset currently reads exercise_templates
-- at runtime.
--
-- Capability: SHANGHAI_V1 + RECREATIONAL + DETAILED_DARTS is
-- declared in seeds/0007_ruleset_version_capabilities.sql, not
-- here — 0007 is the single running ledger every ruleset's
-- capability rows are appended to (see its own git history,
-- e.g. the Bob's 27 ANALYTICS + VISUAL_BOARD addition), mirroring
-- app/src/lib/game/rulesets/capabilities.ts's SHANGHAI_V1 entry.
-- verification/0008_shanghai_capability_checks.sql still asserts
-- the resulting row, whichever seed created it.
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
        '0198f000-0000-7000-8000-000000000007',
        'SHANGHAI',
        'Shanghai',
        'Round-by-round target game: score singles, doubles and trebles of the active number, chase the highest total, or win instantly with a Shanghai.',
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
        '0198f100-0000-7000-8000-000000000007',
        '0198f000-0000-7000-8000-000000000007',
        'SHANGHAI_V1',
        1,
        'Initial Shanghai ruleset: rounds 1-20, full board, Shanghai instant win.',
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
        '0198f300-0000-7000-8000-000000000011',
        '0198f000-0000-7000-8000-000000000007',
        NULL,
        'Shanghai — Standard',
        'Full board, rounds 1 through 20, Shanghai instant win enabled.',
        '{}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
