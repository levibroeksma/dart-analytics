-- ============================================================
-- Seed: 0027_around_the_clock_v2_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Around the Clock V2: the training
-- variants — path direction (low to high / high to low), odds
-- first, outer-single-only segment rule, Easy / 1 / 2 / 3-dart
-- difficulty with a one-target step back on a failed visit,
-- and an untimed or 3-30 minute timed run that restarts the
-- lap at the bull — see
-- app/src/modules/game/around-the-clock.engine.module.ts. No
-- new game_types row: AROUND_THE_CLOCK_V2 is a new
-- ruleset_versions row under the same AROUND_THE_CLOCK game
-- type 0010 already seeded. Without this seed there is no
-- ruleset version to start an AROUND_THE_CLOCK_V2 session from.
--
-- No new configuration_templates row: the setup controller
-- (app/src/lib/game/around-the-clock-setup.data.ts) reuses
-- 0010's empty V1 preset as its templateRef and always supplies
-- all six V2 keys via configOverrides — createSession merges
-- template.configuration with overrides and validates the
-- MERGED result against AroundTheClockV2Config, as 0018
-- established for SINGLES_V3.
--
-- UUID allocation (continues the 0003 range, next after 0018's
-- SINGLES_V3 row, id 000013):
-- - 0198f100-...-000014 ruleset_versions (AROUND_THE_CLOCK_V2)
--
-- Capability: AROUND_THE_CLOCK_V2 + RECREATIONAL +
-- DETAILED_DARTS and AROUND_THE_CLOCK_V2 + ANALYTICS +
-- VISUAL_BOARD are declared in
-- seeds/0007_ruleset_version_capabilities.sql, not here — 0007
-- is the single running ledger every ruleset's capability rows
-- are appended to. verification/0027_around_the_clock_v2_
-- capability_checks.sql asserts the resulting rows.
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
        '0198f100-0000-7000-8000-000000000014',
        '0198f000-0000-7000-8000-000000000009',
        'AROUND_THE_CLOCK_V2',
        2,
        'Around the Clock V2: training variants — direction, odds first, outer single only, 1/2/3-dart difficulty with a one-target step back on a failed visit, and an untimed or 3-30 minute timed run that restarts the lap at the bull.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
