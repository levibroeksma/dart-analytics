-- ============================================================
-- Seed: 0011_one_twenty_one_v2_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for 121 V2: the same checkout-ladder
-- mechanics as 121 V1, plus two additional end conditions —
-- ROUNDS (stop after N attempts) and MINUTES (stop after N
-- minutes) — alongside the unchanged TARGET (climb to 170)
-- mode. No new game_types row: 121_V2 is a new ruleset_versions
-- row under the same ONE_TWENTY_ONE game type 0009 already
-- seeded. Without this seed there is no ruleset version or
-- preset to start a 121_V2 session from — POST /api/sessions
-- has nothing to look up for 121_V2.
--
-- UUID allocation (continues the 0003 range, next after 0010's
-- Around the Clock row):
-- - 0198f100-...-000010 ruleset_versions        (121_V2)
-- - 0198f300-...-000014 configuration_templates (121 — 170)
-- - 0198f300-...-000015 configuration_templates (121 — 10 Rounds)
-- - 0198f300-...-000016 configuration_templates (121 — 5 Minutes)
--
-- Configuration JSONB follows the ruleset configuration schema
-- (app/src/lib/game/rulesets/types.ts) — OneTwentyOneV2Config:
-- `duration_type` is always present; `duration_value` is
-- present for ROUNDS/MINUTES and OMITTED (not merely null) for
-- TARGET, matching the schema's own superRefine.
--
-- No game_type_features mapping: no opponent toggle to
-- configure, mirroring 0009's 121_V1 reasoning. ROUNDS/MINUTES
-- are solo-only by setup-UI convention (docs/superpowers/specs/
-- 2026-08-28-121-rounds-timed-mode-design.md), not a database
-- constraint.
--
-- No exercise_templates row: nothing outside this file's own
-- configuration_templates presets currently reads exercise_
-- templates at runtime.
--
-- Capability: 121_V2 + RECREATIONAL + QUICK_SCORE and 121_V2 +
-- ANALYTICS + VISUAL_BOARD are declared in seeds/0007_ruleset_
-- version_capabilities.sql, not here — 0007 is the single
-- running ledger every ruleset's capability rows are appended
-- to. verification/0011_one_twenty_one_v2_capability_checks.sql
-- asserts the resulting rows.
-- ============================================================
BEGIN;
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
        '0198f100-0000-7000-8000-000000000010',
        '0198f000-0000-7000-8000-000000000008',
        '121_V2',
        2,
        '121 V2: adds ROUNDS (stop after N attempts) and MINUTES (stop after N minutes) end conditions alongside the unchanged TARGET (climb to cap 170) mode. Dart budget, double-out, fail rule unchanged from V1 in every mode.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Configuration presets
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
        '0198f300-0000-7000-8000-000000000014',
        '0198f000-0000-7000-8000-000000000008',
        NULL,
        '121 — 170',
        'Start at 121, double out, 3 visits per attempt, check out 170 to win.',
        '{"duration_type": "TARGET"}'::jsonb,
        TRUE,
        now(),
        now()
    ),
    (
        '0198f300-0000-7000-8000-000000000015',
        '0198f000-0000-7000-8000-000000000008',
        NULL,
        '121 — 10 Rounds',
        'Stop after 10 attempts, whatever target you reach.',
        '{"duration_type": "ROUNDS", "duration_value": 10}'::jsonb,
        TRUE,
        now(),
        now()
    ),
    (
        '0198f300-0000-7000-8000-000000000016',
        '0198f000-0000-7000-8000-000000000008',
        NULL,
        '121 — 5 Minutes',
        'Stop after 5 minutes — the attempt in progress finishes before the session ends.',
        '{"duration_type": "MINUTES", "duration_value": 5}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
