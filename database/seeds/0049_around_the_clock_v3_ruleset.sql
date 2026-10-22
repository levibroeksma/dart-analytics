-- ============================================================
-- Seed: 0049_around_the_clock_v3_ruleset.sql
--
-- Purpose:
-- Seed reference data for Around the Clock V3: Nine Lives, the
-- solo three-lives setting — Easy and untimed, a visit with no
-- hit costs a life, the third lost life ends the run — see
-- app/src/modules/game/around-the-clock.engine.module.ts. No
-- new game_types row: AROUND_THE_CLOCK_V3 is a new
-- ruleset_versions row under the AROUND_THE_CLOCK game type
-- 0010 already seeded.
--
-- No new configuration_templates row: the setup controller
-- reuses 0010's empty V1 preset as its templateRef and supplies
-- every V3 key via configOverrides, as 0027 established for V2.
--
-- UUID allocation (next after 0027's AROUND_THE_CLOCK_V2 row
-- and the rows seeded since, highest in use 000018):
-- - 0198f100-...-000019 ruleset_versions (AROUND_THE_CLOCK_V3)
--
-- Capability: AROUND_THE_CLOCK_V3 + RECREATIONAL +
-- DETAILED_DARTS and AROUND_THE_CLOCK_V3 + ANALYTICS +
-- VISUAL_BOARD are declared in
-- seeds/0007_ruleset_version_capabilities.sql, not here;
-- verification/0007_capability_seed_checks.sql asserts the
-- resulting rows.
-- ============================================================
BEGIN;
INSERT INTO ruleset_versions (
        id,
        game_type_id,
        implementation_key,
        version_number,
        description,
        created_at
    )
VALUES (
        '0198f100-0000-7000-8000-000000000019',
        '0198f000-0000-7000-8000-000000000009',
        'AROUND_THE_CLOCK_V3',
        3,
        'Around the Clock V3: Nine Lives — a solo Easy run with three lives; a visit with no hit costs a life and the third lost life ends the run.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
