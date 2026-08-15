-- ============================================================
-- Seed: 0009_121_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for 121 v1: an X01-style checkout ladder
-- from 121 to 170, 3 visits (9 darts) per attempt. Without this
-- seed there is no game type, ruleset version, or preset to
-- start a session from — POST /api/sessions has nothing to look
-- up for 121_V1.
--
-- UUID allocation (continues the 0003 range, next after 0008's
-- Shanghai row):
-- - 0198f000-...-000008 game_types              (ONE_TWENTY_ONE)
-- - 0198f100-...-000008 ruleset_versions        (121_V1)
-- - 0198f300-...-000012 configuration_templates (121)
--
-- Configuration JSONB follows the ruleset configuration schema
-- (app/src/lib/game/rulesets/types.ts) — OneTwentyOneConfig is a
-- genuinely empty `.strict()` object: v1 locks every rule (start
-- target 121, cap 170, 9-dart budget, double out, fail rule
-- "stay") with nothing left to configure, so its one preset's
-- configuration is `{}`.
--
-- No game_type_features mapping: v1 is single-player only, and
-- there is no duration_type/duration_value or opponent toggle to
-- configure, mirroring 0008's Shanghai reasoning.
--
-- No exercise_templates row: nothing outside this file's own
-- configuration_templates preset currently reads exercise_
-- templates at runtime.
--
-- Capability: 121_V1 + RECREATIONAL + QUICK_SCORE is declared in
-- seeds/0007_ruleset_version_capabilities.sql, not here — 0007 is
-- the single running ledger every ruleset's capability rows are
-- appended to. verification/0009_121_capability_checks.sql
-- asserts the resulting row.
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
        '0198f000-0000-7000-8000-000000000008',
        'ONE_TWENTY_ONE',
        '121',
        'X01-style checkout ladder: start at 121, check out to zero on a double within 3 visits, climb the target on success. Check out 170 to win.',
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
        '0198f100-0000-7000-8000-000000000008',
        '0198f000-0000-7000-8000-000000000008',
        '121_V1',
        1,
        'Initial 121 ruleset: start target 121, double out, 9-dart (3-visit) budget per attempt, fail rule stay, cap target 170.',
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
        '0198f300-0000-7000-8000-000000000012',
        '0198f000-0000-7000-8000-000000000008',
        NULL,
        '121 — Standard',
        'Start at 121, double out, 3 visits per attempt, check out 170 to win.',
        '{}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
