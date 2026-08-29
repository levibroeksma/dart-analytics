-- ============================================================
-- Seed: 0013_singles_training_v2_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Singles Training V2: the same fixed
-- 21-target path, ring-quality scoring, and score-compare match
-- outcome as Singles Training V1, plus two added difficulties —
-- Hard (at least 1 of a visit's 3 darts must land on the
-- current section) and Extreme (at least 2) — on top of the
-- unchanged Easy default (no bust condition). Failing the
-- requirement ends the match immediately by elimination (Bob's
-- 27 pattern); see
-- app/src/modules/game/singles-training.engine.module.ts. No
-- new game_types row: SINGLES_V2 is a new ruleset_versions row
-- under the same SINGLES_TRAINING game type 0003 already seeded.
-- Without this seed there is no ruleset version to start a
-- SINGLES_V2 session from — POST /api/sessions has nothing to
-- look up for SINGLES_V2.
--
-- No new configuration_templates row: SINGLES_V2's setup
-- controller (app/src/lib/game/singles-training-setup.data.ts)
-- reuses 0002's existing "Singles — Low to High, Easy" preset
-- as its templateRef and always supplies `order_mode`,
-- `target_order`, and `difficulty` via its own configOverrides —
-- session.service.ts's createSession merges
-- template.configuration with overrides and validates the
-- MERGED result against SinglesV2Config, so the existing preset
-- is sufficient. A second preset row would only risk
-- configuration-templates?gameType=SINGLES_TRAINING returning
-- two rows with no way for the generic
-- createPresetSetupController's presets[0] pick to prefer the
-- right one (unlike 121_V2, which disambiguates its own several
-- presets by a duration_type field the picker filters on).
--
-- UUID allocation (continues the 0003 range, next after 0012's
-- SHANGHAI_V2 row):
-- - 0198f100-...-000012 ruleset_versions (SINGLES_V2)
--
-- No game_type_features mapping: no opponent toggle to
-- configure beyond what 0001/0003 already established for
-- SINGLES_TRAINING; SinglesV2Config models no duration field
-- either (TIMED_MODE/ROUNDS_MODE do not apply, same as V1).
--
-- No exercise_templates row: nothing outside 0002's own
-- configuration_templates preset currently reads
-- exercise_templates at runtime.
--
-- Capability: SINGLES_V2 + RECREATIONAL + DETAILED_DARTS and
-- SINGLES_V2 + ANALYTICS + VISUAL_BOARD are declared in
-- seeds/0007_ruleset_version_capabilities.sql, not here — 0007
-- is the single running ledger every ruleset's capability rows
-- are appended to. verification/0013_singles_training_v2_
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
        '0198f100-0000-7000-8000-000000000012',
        '0198f000-0000-7000-8000-000000000003',
        'SINGLES_V2',
        2,
        'Singles Training V2: adds Hard/Extreme mandatory-hit difficulties (Easy default) alongside V1''s unchanged 21-target path and scoring. Failing the mandatory-hit requirement ends the match immediately by elimination.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
